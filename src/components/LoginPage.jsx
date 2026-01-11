// src/pages/LoginPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const LOGO_SRC = '/fuelwale-logo.png';
const OTP_RESEND_GAP_SEC = 45;

const MODE = {
  PASSWORD: 'PASSWORD',
  OTP: 'OTP',
};

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
  } catch {
    return await api.get(url, { headers: { Authorization: token } });
  }
}

function extractDepotCdFromEmployee(emp, depots) {
  if (!emp) return '';

  const ref =
    emp?.depotCd ||
    emp?.depot ||
    emp?.depotId ||
    emp?.depotCode ||
    '';

  if (typeof ref === 'string' && ref.trim() && !/^[0-9a-fA-F]{24}$/.test(ref.trim())) {
    return up(ref);
  }

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

  let depots = [];
  try {
    const depRes = await authedGet('/depots', token);
    depots = Array.isArray(depRes.data) ? depRes.data : [];
  } catch {
    depots = [];
  }

  try {
    const me = await authedGet('/users/me', token);
    const dc = pickDepotCd(me?.data, null);
    if (dc) return dc;
  } catch {}

  if (ut === 'E') {
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
        const emp = Array.isArray(data)
          ? data.find(x => up(x?.empCd) === uid) || data[0]
          : data;

        const dc = extractDepotCdFromEmployee(emp, depots);
        if (dc) return dc;
      } catch {}
    }

    try {
      const r = await authedGet('/employees', token);
      const list = Array.isArray(r.data) ? r.data : [];
      const emp = list.find(x => up(x?.empCd) === uid);
      const dc = extractDepotCdFromEmployee(emp, depots);
      if (dc) return dc;
    } catch {}
  }

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

        const dc = extractDepotCdFromEmployee(driver, depots);
        if (dc) return dc;
      } catch {}
    }
  }

  return '';
}

function parseRetrySecondsFromMessage(msg) {
  const m = String(msg || '').match(/in\s+(\d+)\s*s/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ userId: '', pwd: '', otp: '' });
  const userIdTrimmed = useMemo(() => String(form.userId || '').trim(), [form.userId]);

  const [mode, setMode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const [showPwd, setShowPwd] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const pwdRef = useRef(null);
  const otpRef = useRef(null);

  useEffect(() => {
    try {
      const lastUser = localStorage.getItem('lastUserId');
      if (lastUser) setForm(prev => ({ ...prev, userId: lastUser }));
    } catch {}
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => {
      setResendIn(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (mode === MODE.PASSWORD) setTimeout(() => pwdRef.current?.focus?.(), 50);
    if (mode === MODE.OTP) setTimeout(() => otpRef.current?.focus?.(), 50);
  }, [mode]);

  const mapErrorMessage = (err) => {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.error || err?.response?.data?.message;

    if (status === 400) return serverMsg || 'Invalid request. Please check your inputs.';
    if (status === 401) return serverMsg || 'Invalid credentials / OTP.';
    if (status === 403) return serverMsg || 'Access denied.';
    if (status === 404) return serverMsg || 'User not found.';
    if (status === 429) return serverMsg || 'Too many attempts. Please try again later.';
    if (status >= 500) return serverMsg || 'Server error. Please try again.';
    if (err?.code === 'ECONNABORTED') return 'Network timeout. Check your connection.';
    return serverMsg || 'Login failed';
  };

  async function finalizeLogin({ result, userId }) {
    try {
      localStorage.setItem('lastUserId', String(userId || '').trim());
    } catch {}

    const tokenFromResult = pickTokenFromResult(result);
    const tokenFromStorage =
      tokenFromResult ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      '';

    if (tokenFromResult) {
      try {
        if (!localStorage.getItem('token') && !localStorage.getItem('authToken')) {
          localStorage.setItem('token', tokenFromResult);
        }
      } catch {}
    }

    try {
      if (typeof auth?.setToken === 'function' && tokenFromResult) auth.setToken(tokenFromResult);
      if (typeof auth?.setAuthToken === 'function' && tokenFromResult) auth.setAuthToken(tokenFromResult);
    } catch {}

    const decoded = tokenFromStorage ? safeJwtDecode(tokenFromStorage) : null;
    const userType = pickUserType(result, decoded);

    if (userType === 'A') {
      try {
        localStorage.removeItem('depotCd');
      } catch {}
      navigate('/');
      return;
    }

    let depotCd = pickDepotCd(result, decoded);

    if (!depotCd) {
      depotCd = await fetchDepotCdFallback({
        userId,
        userType,
        token: tokenFromStorage,
      });
    }

    if (!depotCd) {
      setError(
        'Depot not assigned (or profile endpoint is not accessible for this user). ' +
          'Please ensure depotCd is returned in login/JWT OR enable a /users/me endpoint.'
      );
      return;
    }

    try {
      localStorage.setItem('depotCd', depotCd);
    } catch {}

    navigate('/');
  }

  function resetOtpState() {
    setOtpRequested(false);
    setOtpSentTo('');
    setResendIn(0);
    setForm(prev => ({ ...prev, otp: '' }));
  }

  function onUserIdChange(value) {
    setForm(prev => ({ ...prev, userId: value }));
    setError('');
    setInfo('');

    if (mode) setMode('');
    resetOtpState();

    setForm(prev => ({ ...prev, userId: value, pwd: '', otp: '' }));
    setCapsLockOn(false);
  }

  function selectMode(nextMode) {
    if (!userIdTrimmed) {
      setError('Please enter User ID first.');
      return;
    }
    setMode(nextMode);
    setError('');
    setInfo('');
    setCapsLockOn(false);

    if (nextMode === MODE.PASSWORD) {
      resetOtpState();
      setForm(prev => ({ ...prev, otp: '' }));
    } else {
      setForm(prev => ({ ...prev, pwd: '' }));
    }
  }

  const handlePwdKeyEvents = (e) => {
    if (e.getModifierState) setCapsLockOn(e.getModifierState('CapsLock'));
  };

  async function handlePasswordLogin() {
    const userId = userIdTrimmed;
    const pwd = String(form.pwd || '');

    if (!userId) {
      setError('Please enter User ID.');
      return;
    }
    if (!pwd) {
      setError('Please enter Password.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (typeof auth?.login !== 'function') {
        throw new Error('AuthContext.login is not available');
      }
      const result = await auth.login({ userId, pwd });
      await finalizeLogin({ result, userId });
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpRequest() {
    const userId = userIdTrimmed;

    if (!userId) {
      setError('Please enter User ID.');
      return;
    }
    if (resendIn > 0) return;

    setLoading(true);
    setError('');
    setInfo('');
    setOtpSentTo('');

    try {
      const res = await api.post('/users/login/otp/request', { userId });
      const sentTo = res?.data?.sentTo || '';
      setOtpSentTo(sentTo);
      setOtpRequested(true);
      setResendIn(OTP_RESEND_GAP_SEC);
      setInfo(sentTo ? `OTP sent to ${sentTo}` : 'OTP sent successfully. Please enter OTP.');
      setTimeout(() => otpRef.current?.focus?.(), 50);
    } catch (err) {
      const msg = mapErrorMessage(err);
      setError(msg);

      const retry = parseRetrySecondsFromMessage(msg);
      if (retry > 0) setResendIn(retry);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerifyOrSend() {
    const userId = userIdTrimmed;

    if (!userId) {
      setError('Please enter User ID.');
      return;
    }

    if (!otpRequested) {
      await handleOtpRequest();
      return;
    }

    const otp = String(form.otp || '').trim();
    if (!otp || otp.length < 4) {
      setError('Please enter a valid OTP.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await api.post('/users/login/otp/verify', { userId, otp });
      await finalizeLogin({ result: res, userId });
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError('');
    setInfo('');

    if (!userIdTrimmed) {
      setError('Please enter User ID.');
      return;
    }
    if (!mode) {
      setError('Please choose Password or OTP.');
      return;
    }

    if (mode === MODE.PASSWORD) {
      await handlePasswordLogin();
      return;
    }
    await handleOtpVerifyOrSend();
  }

  const isPassword = mode === MODE.PASSWORD;
  const isOtp = mode === MODE.OTP;
  const canChooseMode = Boolean(userIdTrimmed) && !loading;

  const actionText = (() => {
    if (!mode) return 'CONTINUE';
    if (isPassword) return loading ? 'LOGGING IN…' : 'LOGIN';
    if (!otpRequested) return loading ? 'SENDING OTP…' : 'SEND OTP';
    return loading ? 'VERIFYING…' : 'VERIFY & LOGIN';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-100/50 p-8 sm:p-10">
          
          {/* Header */}
          <div className="text-center mb-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
              <img
                src={LOGO_SRC}
                alt="Fuelwale"
                className="h-12 w-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-600 via-indigo-700 to-blue-800 bg-clip-text text-transparent tracking-tight">
              Fuelwale
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto mt-4 rounded-full shadow-sm" />
            <p className="text-sm text-gray-600 mt-3 font-medium">Welcome back! Please sign in to your account</p>
          </div>

          {/* Alerts */}
          <div className="mb-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800 flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            {info && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800 flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {info}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* User ID */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3 tracking-wide">User ID</label>
              <input
                name="userId"
                value={form.userId}
                onChange={(e) => onUserIdChange(e.target.value)}
                className="w-full h-14 px-5 py-3 bg-white/50 backdrop-blur-sm border-2 border-blue-200 rounded-2xl text-lg font-semibold text-gray-900 placeholder-gray-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 focus:outline-none transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                inputMode="text"
                autoComplete="username"
                maxLength={32}
                placeholder="Enter your User ID"
                disabled={loading}
              />
            </div>

            {/* Mode Selection */}
            {canChooseMode && (
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3 tracking-wide">Choose Login Method</label>
                <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-1 border-2 border-blue-200 shadow-inner">
                  <button
                    type="button"
                    className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
                      isPassword
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                        : 'text-blue-700 hover:text-blue-900 hover:bg-white/50'
                    }`}
                    onClick={() => selectMode(MODE.PASSWORD)}
                    disabled={loading}
                  >
                    🔐 Password
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
                      isOtp
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                        : 'text-blue-700 hover:text-blue-900 hover:bg-white/50'
                    }`}
                    onClick={() => selectMode(MODE.OTP)}
                    disabled={loading}
                  >
                    📱 OTP
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Content - Only show when mode selected */}
            {mode && (
              <div className="space-y-6 pt-2">
                {/* Password Field */}
                {isPassword && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3 tracking-wide">Password</label>
                      <div className="relative">
                        <input
                          ref={pwdRef}
                          name="pwd"
                          type={showPwd ? 'text' : 'password'}
                          value={form.pwd}
                          onChange={(e) => {
                            setForm(prev => ({ ...prev, pwd: e.target.value }));
                            setError('');
                            setInfo('');
                          }}
                          onKeyUp={handlePwdKeyEvents}
                          onKeyDown={handlePwdKeyEvents}
                          onBlur={() => setCapsLockOn(false)}
                          className="w-full h-14 pr-16 px-5 py-3 bg-white/50 backdrop-blur-sm border-2 border-blue-200 rounded-2xl text-lg font-semibold text-gray-900 placeholder-gray-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 focus:outline-none transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          aria-label={showPwd ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPwd(s => !s)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                          disabled={loading}
                        >
                          {showPwd ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>

                    {capsLockOn && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
                        <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-xs font-bold text-white">⌨️</div>
                        Caps Lock is ON
                      </div>
                    )}
                  </>
                )}

                {/* OTP Field */}
                {isOtp && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3 tracking-wide">OTP</label>
                      <input
                        ref={otpRef}
                        name="otp"
                        value={form.otp}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
                          setForm(prev => ({ ...prev, otp: v }));
                          setError('');
                          setInfo('');
                        }}
                        className="w-full h-14 px-5 py-3 bg-white/50 backdrop-blur-sm border-2 border-blue-200 rounded-2xl text-lg font-semibold text-gray-900 placeholder-gray-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 focus:outline-none transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-center tracking-widest"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder={otpRequested ? 'Enter 4-6 digit OTP' : 'Click SEND OTP first'}
                        disabled={loading || !otpRequested}
                      />
                    </div>

                    {/* OTP Status */}
                    <div className="pt-2">
                      <div className="text-sm text-gray-600 bg-gray-50/50 rounded-xl p-4 border border-gray-200">
                        {otpRequested ? (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center text-xs font-bold text-white">✓</div>
                              <span>OTP sent{otpSentTo ? ` to ${otpSentTo}` : ''}</span>
                            </div>
                            <button
                              type="button"
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              onClick={handleOtpRequest}
                              disabled={loading || resendIn > 0}
                            >
                              {resendIn > 0 ? `Resend (${resendIn}s)` : 'Resend OTP'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-gray-500">
                            <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center text-xs font-bold text-white animate-pulse">📱</div>
                            Click "SEND OTP" to receive code on your registered mobile
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full h-14 rounded-2xl font-black text-xl tracking-wide transition-all duration-300 shadow-2xl ${
                loading || !userIdTrimmed || !mode
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 active:scale-95 transform'
              } text-white flex items-center justify-center gap-3 disabled:shadow-none`}
              disabled={loading || !userIdTrimmed || !mode}
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {actionText}
                </>
              ) : (
                actionText
              )}
            </button>

            <div className="text-xs text-gray-500 text-center pt-2">
              👨‍💼 Driver users must have an assigned/active trip to log in
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-500">
          © 2026 Fuelwale. All rights reserved.
        </div>
      </div>
    </div>
  );
}
