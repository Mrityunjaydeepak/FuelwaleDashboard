import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

function safeJwtDecode(token) {
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function pickTokenFromResult(result) {
  return (
    result?.token ||
    result?.authToken ||
    result?.data?.token ||
    result?.data?.authToken ||
    ''
  );
}

function pickUserType(result, decoded) {
  return (
    result?.userType ||
    result?.data?.userType ||
    result?.data?.user?.userType ||
    result?.user?.userType ||
    decoded?.userType ||
    ''
  );
}

function pickDepotCd(result, decoded) {
  const candidates = [
    result?.depotCd,
    result?.depotCode,
    result?.userDepotCd,
    result?.user?.depotCd,
    result?.data?.depotCd,
    result?.data?.depotCode,
    result?.data?.userDepotCd,
    result?.data?.user?.depotCd,
    decoded?.depotCd,
    decoded?.depotCode,
    decoded?.userDepotCd,
  ];

  const found = candidates.find(v => typeof v === 'string' && v.trim());
  return found ? found.trim().toUpperCase() : '';
}

const up = (v) => String(v ?? '').trim().toUpperCase();

async function authedGet(url, token) {
  if (!token) throw new Error('Missing token');
  try {
    return await api.get(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e1) {
    // some backends expect raw token instead of Bearer
    return await api.get(url, { headers: { Authorization: token } });
  }
}

function extractDepotCdFromEmployee(emp, depots) {
  if (!emp) return '';

  // employee depot may be in different keys depending on your backend
  const ref =
    emp?.depotCd ||
    emp?.depot ||
    emp?.depotId ||
    emp?.depotCode ||
    '';

  // If already a depot code string like "271"
  if (typeof ref === 'string' && ref.trim() && !/^[0-9a-fA-F]{24}$/.test(ref.trim())) {
    return up(ref);
  }

  // If it is an objectId string or populated object
  const id =
    (typeof ref === 'string' && /^[0-9a-fA-F]{24}$/.test(ref.trim()) ? ref.trim() : '') ||
    ref?._id ||
    ref?.id ||
    emp?.depotCd?._id ||
    emp?.depot?._id ||
    '';

  if (!id) return '';

  const d = (depots || []).find(x => String(x._id) === String(id));
  return d?.depotCd ? up(d.depotCd) : '';
}

async function fetchDepotCdFallback({ userId, userType, token }) {
  const uid = up(userId);
  const ut = up(userType);

  // Load depots for mapping objectId -> depotCd
  let depots = [];
  try {
    const depRes = await authedGet('/depots', token);
    depots = Array.isArray(depRes.data) ? depRes.data : [];
  } catch {
    depots = [];
  }

  // 1) If you have a /users/me endpoint, try it first (if allowed)
  try {
    const me = await authedGet('/users/me', token);
    const dc = pickDepotCd(me?.data, null);
    if (dc) return dc;
  } catch {
    // ignore
  }

  // 2) Employee user: userId == empCd (your system)
  if (ut === 'E') {
    // try common patterns
    const urls = [
      `/employees/by-empCd/${encodeURIComponent(uid)}`,
      `/employees/byEmpCd/${encodeURIComponent(uid)}`,
      `/employees/empCd/${encodeURIComponent(uid)}`,
      `/employees?empCd=${encodeURIComponent(uid)}`,
    ];

    for (const url of urls) {
      try {
        const r = await authedGet(url, token);
        const data = r?.data;

        // could be object or array
        const emp = Array.isArray(data)
          ? data.find(x => up(x?.empCd) === uid) || data[0]
          : data;

        const dc = extractDepotCdFromEmployee(emp, depots);
        if (dc) return dc;
      } catch {
        // keep trying
      }
    }

    // last fallback: load all employees and find empCd (only works if endpoint permitted)
    try {
      const r = await authedGet('/employees', token);
      const list = Array.isArray(r.data) ? r.data : [];
      const emp = list.find(x => up(x?.empCd) === uid);
      const dc = extractDepotCdFromEmployee(emp, depots);
      if (dc) return dc;
    } catch {
      // ignore
    }
  }

  // 3) Driver user (if your userType is D and userId == driverCd)
  if (ut === 'D') {
    const urls = [
      `/drivers/by-driverCd/${encodeURIComponent(uid)}`,
      `/drivers/byDriverCd/${encodeURIComponent(uid)}`,
      `/drivers/driverCd/${encodeURIComponent(uid)}`,
      `/drivers?driverCd=${encodeURIComponent(uid)}`,
    ];
    for (const url of urls) {
      try {
        const r = await authedGet(url, token);
        const data = r?.data;
        const driver = Array.isArray(data)
          ? data.find(x => up(x?.driverCd) === uid) || data[0]
          : data;

        // driver depot can be in driver.depot / driver.depotCd etc.
        const dc = extractDepotCdFromEmployee(driver, depots);
        if (dc) return dc;
      } catch {}
    }
  }

  // If nothing worked, return empty
  return '';
}

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ userId: '', pwd: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const lastUser = localStorage.getItem('lastUserId');
      if (lastUser) setCredentials(prev => ({ ...prev, userId: lastUser }));
    } catch (_) {}
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handlePwdKeyEvents = e => {
    if (e.getModifierState) setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const mapErrorMessage = err => {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.error;

    if (status === 401) return serverMsg || 'Invalid User ID or Password.';
    if (status === 403) return serverMsg || 'Access denied.';
    if (status === 404) return serverMsg || 'User not found.';
    if (status === 429) return serverMsg || 'Too many attempts. Please try again later.';
    if (status >= 500) return 'Server error. Please try again.';
    if (err?.code === 'ECONNABORTED') return 'Network timeout. Check your connection.';
    return serverMsg || 'Login failed';
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    const userId = String(credentials.userId || '').trim();
    const pwd = String(credentials.pwd || '');

    if (!userId || !pwd) {
      setLoading(false);
      setError('Please enter both User ID and Password.');
      return;
    }

    try {
      const result = await login({ userId, pwd });

      try {
        localStorage.setItem('lastUserId', userId);
      } catch (_) {}

      // Ensure we have a token for fallback calls
      const tokenFromResult = pickTokenFromResult(result);
      const tokenFromStorage =
        tokenFromResult ||
        localStorage.getItem('token') ||
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('token') ||
        '';

      // Make sure api interceptor can see a token (if your app uses it)
      if (tokenFromResult && !localStorage.getItem('token') && !localStorage.getItem('authToken')) {
        try {
          localStorage.setItem('token', tokenFromResult);
        } catch (_) {}
      }

      const decoded = tokenFromStorage ? safeJwtDecode(tokenFromStorage) : null;
      const userType = pickUserType(result, decoded);

      // Admin: keep existing behavior, do not require depot
      if (userType === 'A') {
        try {
          localStorage.removeItem('depotCd');
        } catch (_) {}
        navigate('/');
        return;
      }

      // First try result/JWT
      let depotCd = pickDepotCd(result, decoded);

      // Fallback: derive depotCd from employee/driver master (most reliable in your setup)
      if (!depotCd) {
        depotCd = await fetchDepotCdFallback({
          userId,
          userType,
          token: tokenFromStorage,
        });
      }

      if (!depotCd) {
        // This means: backend does not expose depot for the logged-in user via any endpoint accessible to them
        setError(
          'Depot not assigned (or profile endpoint is not accessible for this user). ' +
          'Please ensure depotCd is returned in login/JWT OR enable a /users/me endpoint.'
        );
        return;
      }

      try {
        localStorage.setItem('depotCd', depotCd);
      } catch (_) {}

      navigate('/');
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-full max-w-sm"
        noValidate
      >
        <h2 className="text-2xl mb-6 text-center">Login</h2>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium">User ID</label>
          <input
            name="userId"
            value={credentials.userId}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
            required
            inputMode="text"
            autoComplete="username"
            maxLength={15}
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="mb-1">
          <label className="block mb-1 text-sm font-medium">Password</label>
          <div className="relative">
            <input
              name="pwd"
              type={showPwd ? 'text' : 'password'}
              value={credentials.pwd}
              onChange={handleChange}
              onKeyUp={handlePwdKeyEvents}
              onKeyDown={handlePwdKeyEvents}
              onBlur={() => setCapsLockOn(false)}
              className="w-full border rounded px-3 py-2 pr-12 outline-none focus:ring-2 focus:ring-blue-200"
              required
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              onClick={() => setShowPwd(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:underline"
              tabIndex={-1}
            >
              {showPwd ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {capsLockOn && (
          <div className="mb-3 text-xs text-amber-600">Warning: Caps Lock is ON</div>
        )}

        <button
          type="submit"
          className={`w-full text-white py-2 rounded ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          disabled={loading}
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>

        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>• If you recently removed a user, they cannot log in until restored.</p>
          <p>• Driver users need an assigned/active trip to log in.</p>
        </div>
      </form>
    </div>
  );
}
