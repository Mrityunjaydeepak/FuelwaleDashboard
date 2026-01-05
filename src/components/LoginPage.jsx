// src/pages/LoginPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

/**
 * Paste-ready production Login Page:
 * - Matches the screenshot layout (logo + divider + LOGIN + 3 rows)
 * - Enhanced UI (card, spacing, segmented mode switch, better inputs, clearer states)
 * - Flow:
 *    1) Enter USER ID
 *    2) Choose PASSWORD or OTP
 *    3) If PASSWORD -> login
 *       If OTP -> first submit sends OTP, second submit verifies OTP and logs in
 *
 * Logo:
 * - Put your logo at: /public/fuelwale-logo.png
 * - Or change LOGO_SRC below.
 */

const LOGO_SRC = '/fuelwale-logo.png';
const OTP_RESEND_GAP_SEC = 45; // matches backend RESEND_WINDOW_MS=45s

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
    // some backends expect raw token instead of Bearer
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

  // depot code string like "271"
  if (typeof ref === 'string' && ref.trim() && !/^[0-9a-fA-F]{24}$/.test(ref.trim())) {
    return up(ref);
  }

  // objectId string or populated object
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

  // 1) /users/me if available
  try {
    const me = await authedGet('/users/me', token);
    const dc = pickDepotCd(me?.data, null);
    if (dc) return dc;
  } catch {
    // ignore
  }

  // 2) Employee user: userId == empCd
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
      } catch {
        // keep trying
      }
    }

    // last fallback: load all employees (only if endpoint permitted)
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

  // 3) Driver user
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
      } catch {
        // ignore
      }
    }
  }

  return '';
}

function parseRetrySecondsFromMessage(msg) {
  // backend: "OTP sent recently. Try again in 12s."
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

  const [mode, setMode] = useState(''); // '' | MODE.PASSWORD | MODE.OTP
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
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }

    const tokenFromResult = pickTokenFromResult(result);
    const tokenFromStorage =
      tokenFromResult ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      '';

    // persist token for OTP flow (AuthContext may not do this automatically)
    if (tokenFromResult) {
      try {
        if (!localStorage.getItem('token') && !localStorage.getItem('authToken')) {
          localStorage.setItem('token', tokenFromResult);
        }
      } catch {
        // ignore
      }
    }

    // best-effort to inform AuthContext (optional)
    try {
      if (typeof auth?.setToken === 'function' && tokenFromResult) auth.setToken(tokenFromResult);
      if (typeof auth?.setAuthToken === 'function' && tokenFromResult) auth.setAuthToken(tokenFromResult);
    } catch {
      // ignore
    }

    const decoded = tokenFromStorage ? safeJwtDecode(tokenFromStorage) : null;
    const userType = pickUserType(result, decoded);

    // Admin: do not require depot
    if (userType === 'A') {
      try {
        localStorage.removeItem('depotCd');
      } catch {
        // ignore
      }
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
    } catch {
      // ignore
    }

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

    // Changing userId should reset auth mode and OTP state (prevents stale OTP confusion)
    if (mode) setMode('');
    resetOtpState();

    // clear password if changing user
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

      // if backend tells retry seconds, reflect it on UI
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

    // First submit in OTP mode sends OTP
    if (!otpRequested) {
      await handleOtpRequest();
      return;
    }

    // Second submit verifies
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

  const labelBase =
    'text-[15px] font-semibold tracking-wide text-gray-900';
  const inputBase =
    'w-full border-2 border-green-500 rounded-xl px-5 py-4 text-[15px] ' +
    'outline-none focus:ring-4 focus:ring-green-100 transition disabled:bg-gray-50 disabled:cursor-not-allowed';

  const pillWrap =
    'inline-flex rounded-xl bg-green-50 p-1 border border-green-200';
  const pillBtn = (active) =>
    `px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition ` +
    (active ? 'bg-green-600 text-white shadow-sm' : 'text-green-800 hover:bg-green-100');

  const primaryBtn =
    'w-full sm:w-64 rounded-xl bg-green-600 px-6 py-4 text-white font-extrabold tracking-wide ' +
    'hover:bg-green-700 active:bg-green-800 transition disabled:opacity-60 disabled:cursor-not-allowed';

  const secondaryLink =
    'text-sm font-semibold text-green-700 hover:text-green-800 hover:underline transition';

  const actionText = (() => {
    if (!mode) return 'CONTINUE';
    if (isPassword) return loading ? 'LOGGING IN…' : 'LOGIN';
    // OTP
    if (!otpRequested) return loading ? 'SENDING OTP…' : 'SEND OTP';
    return loading ? 'VERIFYING…' : 'VERIFY & LOGIN';
  })();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-100 px-6 sm:px-16 py-10 sm:py-14">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <img
              src={LOGO_SRC}
              alt="Fuelwale"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="w-full max-w-3xl mt-6 border-t border-gray-200" />
            <h1 className="mt-10 text-5xl font-extrabold tracking-[0.12em] text-black">
              LOGIN
            </h1>
          </div>

          <div className="mt-12">
            {/* Alerts */}
            <div className="mx-auto max-w-3xl">
              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                  {error}
                </div>
              )}
              {info && (
                <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-900">
                  {info}
                </div>
              )}
            </div>

            {/* Form body (screenshot-like alignment) */}
            <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-3xl">
              <div className="space-y-10">
                {/* USER ID */}
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center">
                  <label className={labelBase}>USER ID</label>
                  <input
                    name="userId"
                    value={form.userId}
                    onChange={(e) => onUserIdChange(e.target.value)}
                    className={inputBase}
                    inputMode="text"
                    autoComplete="username"
                    maxLength={32}
                    disabled={loading}
                  />
                </div>

                {/* Mode choice (kept clean, sits under USER ID, like a subtle enhancement) */}
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center">
                  <div />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className={pillWrap} role="tablist" aria-label="Login mode">
                      <button
                        type="button"
                        className={pillBtn(isPassword)}
                        onClick={() => selectMode(MODE.PASSWORD)}
                        disabled={!canChooseMode}
                        role="tab"
                        aria-selected={isPassword}
                      >
                        PASSWORD
                      </button>
                      <button
                        type="button"
                        className={pillBtn(isOtp)}
                        onClick={() => selectMode(MODE.OTP)}
                        disabled={!canChooseMode}
                        role="tab"
                        aria-selected={isOtp}
                      >
                        OTP
                      </button>
                    </div>

                    {mode && (
                      <button
                        type="button"
                        className={secondaryLink}
                        onClick={() => {
                          setMode('');
                          setError('');
                          setInfo('');
                          setForm(prev => ({ ...prev, pwd: '', otp: '' }));
                          resetOtpState();
                        }}
                        disabled={loading}
                      >
                        Change method
                      </button>
                    )}
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center">
                  <label className={labelBase}>PASSWORD</label>
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
                      className={`${inputBase} pr-16`}
                      autoComplete="current-password"
                      disabled={loading || !isPassword}
                      aria-disabled={loading || !isPassword}
                    />
                    <button
                      type="button"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPwd(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-green-700 hover:underline disabled:opacity-60"
                      tabIndex={-1}
                      disabled={!isPassword}
                    >
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {capsLockOn && isPassword && (
                  <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center">
                    <div />
                    <div className="text-xs text-amber-700">
                      Caps Lock is ON
                    </div>
                  </div>
                )}

                {/* OTP */}
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center">
                  <label className={labelBase}>OTP</label>
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
                    className={inputBase}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={isOtp && otpRequested ? 'Enter OTP' : ''}
                    disabled={loading || !isOtp}
                    aria-disabled={loading || !isOtp}
                  />
                </div>

                {/* OTP helper row (resend status) */}
                {isOtp && (
                  <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-10 items-center -mt-6">
                    <div />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                      <div className="text-gray-600">
                        {otpRequested ? (
                          <>
                            OTP sent{otpSentTo ? ` to ${otpSentTo}` : ''}.
                            {' '}
                            {resendIn > 0 ? (
                              <span className="text-gray-500">Resend available in {resendIn}s.</span>
                            ) : (
                              <span className="text-gray-500">You can resend now.</span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-500">Click “SEND OTP” to receive a one-time password.</span>
                        )}
                      </div>

                      {otpRequested && (
                        <button
                          type="button"
                          className={secondaryLink}
                          onClick={handleOtpRequest}
                          disabled={loading || resendIn > 0}
                        >
                          {resendIn > 0 ? `Resend (${resendIn}s)` : 'Resend OTP'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Primary action button */}
                <div className="pt-4 flex flex-col items-center gap-3">
                  <button
                    type="submit"
                    className={primaryBtn}
                    disabled={loading || !userIdTrimmed || !mode}
                  >
                    {actionText}
                  </button>

                  {/* Small guidance line (kept understated) */}
                  <div className="text-xs text-gray-500 text-center max-w-xl">
                    Driver users must have an assigned/active trip to log in.
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Subtle footer spacing like screenshot margins */}
        <div className="h-6" />
      </div>
    </div>
  );
}
