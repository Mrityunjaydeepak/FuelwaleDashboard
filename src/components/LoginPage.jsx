import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ userId: '', pwd: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Autofocus fix on certain browsers and restore last userId if you want
  useEffect(() => {
    try {
      const lastUser = localStorage.getItem('lastUserId');
      if (lastUser) {
        setCredentials(prev => ({ ...prev, userId: lastUser }));
      }
    } catch (_) {}
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handlePwdKeyEvents = e => {
    // Caps Lock indicator
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const normalize = vals => ({
    userId: (vals.userId || '').trim(),      // trim to avoid trailing spaces
    pwd:    (vals.pwd || '')                 // keep case sensitivity for passwords
  });

  const mapErrorMessage = err => {
    // Prefer exact backend message when safe, but map common HTTP codes to friendlier text
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
    if (loading) return; // prevent double submit
    setError('');
    setLoading(true);

    const payload = normalize(credentials);

    // Simple client validations to surface issues early
    if (!payload.userId || !payload.pwd) {
      setLoading(false);
      setError('Please enter both User ID and Password.');
      return;
    }

    try {
      await login(payload); // AuthContext should post to /api/users/login with { userId, pwd }
      try {
        localStorage.setItem('lastUserId', payload.userId);
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
        <h2 className="text-2xl mb-6 text-center">Admin Login</h2>

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
            maxLength={15} // matches schema max length
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

        {/* Small helper notes */}
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>• If you recently removed a user, they cannot log in until restored.</p>
          <p>• Driver users need an assigned/active trip to log in.</p>
        </div>
      </form>
    </div>
  );
}
