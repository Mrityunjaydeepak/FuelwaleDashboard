// context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import api from '../api';

const AuthContext = createContext();

// ---------- helpers ----------
const canUseStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function safeGetItem(key) {
  if (!canUseStorage) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key, val) {
  if (!canUseStorage) return;
  try { window.localStorage.setItem(key, val); } catch {}
}
function safeRemoveItem(key) {
  if (!canUseStorage) return;
  try { window.localStorage.removeItem(key); } catch {}
}

/** Decode a JWT without verifying (client-side convenience) */
function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return {};
    // URL-safe base64
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob !== 'undefined' ? atob(normalized) : Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function mergeUserFrom(token, responseBody, stored) {
  const payload = token ? decodeJwt(token) : {};
  // Prefer server-provided values when present, else fallback to token, then stored
  const rolesFromServer = Array.isArray(responseBody?.roles) ? responseBody.roles : null;
  const rolesFromToken  = Array.isArray(payload?.roles) ? payload.roles : null;
  const rolesFromStored = Array.isArray(stored?.roles) ? stored.roles : [];

  return {
    id:       responseBody?.id ?? payload?.id ?? stored?.id ?? null,
    userId:   responseBody?.userId ?? stored?.userId ?? null, // usually not in JWT
    userType: responseBody?.userType ?? payload?.userType ?? stored?.userType ?? null,
    roles:    rolesFromServer ?? rolesFromToken ?? rolesFromStored
  };
}

// Keep axios header in sync
function setAuthHeader(token) {
  if (!api?.defaults?.headers) return;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// ---------- provider ----------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Rehydrate on app load — if we only had a token, also WRITE the merged user back to storage
  useEffect(() => {
    const token  = safeGetItem('token');
    const stored = (() => {
      const raw = safeGetItem('user');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    })();

    if (token) {
      setAuthHeader(token);
      const nextUser = mergeUserFrom(token, null, stored);
      setUser(nextUser);

      // ensure localStorage actually has the merged user (fixes “not saving” cases)
      safeSetItem('user', JSON.stringify(nextUser));
    } else {
      setAuthHeader(null);
    }
  }, []);

  const persistSession = (token, responseBody) => {
    // 1) save token
    safeSetItem('token', token);
    setAuthHeader(token);

    // 2) merge user (token + server body + any previous)
    const stored = (() => {
      const raw = safeGetItem('user');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    const userInfo = mergeUserFrom(token, responseBody, stored);

    // 3) save merged user
    safeSetItem('user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  const login = async (credentials) => {
    // API returns: { token, userId, userType, roles }
    const { data } = await api.post('/users/login', credentials);
    persistSession(data.token, data);
  };

  const loginWithOtp = async ({ userId, mobileNo, otp }) => {
    const { data } = await api.post('/users/login/otp/verify', { userId, mobileNo, otp });
    persistSession(data.token, data);
  };

  const logout = () => {
    safeRemoveItem('token');
    safeRemoveItem('user');
    setAuthHeader(null);
    setUser(null);
  };

  // Convenience guards
  const hasRole = (...roles) => !!user?.roles?.some(r => roles.includes(r));
  const isAdmin = () => hasRole('ADMIN');

  // Keep a stable value to avoid re-renders
  const value = useMemo(() => ({
    user, login, loginWithOtp, logout, hasRole, isAdmin
  }), [user]);

  // Sync across tabs (if one tab logs out/logs in)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token') {
        const token = safeGetItem('token');
        const stored = (() => {
          const raw = safeGetItem('user');
          if (!raw) return null;
          try { return JSON.parse(raw); } catch { return null; }
        })();

        if (token) {
          setAuthHeader(token);
          const nextUser = mergeUserFrom(token, null, stored);
          setUser(nextUser);
        } else {
          setAuthHeader(null);
          setUser(null);
        }
      }
      if (e.key === 'user' && safeGetItem('token')) {
        const token = safeGetItem('token');
        const stored = (() => {
          const raw = safeGetItem('user');
          if (!raw) return null;
          try { return JSON.parse(raw); } catch { return null; }
        })();
        const nextUser = mergeUserFrom(token, null, stored);
        setUser(nextUser);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
