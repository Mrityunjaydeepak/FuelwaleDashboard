import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ userId: '', pwd: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => {
    setCredentials(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await login(credentials);
      navigate('/');
    } catch (err) {
      // Show the exact error message from the server if available
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
        <h2 className="text-2xl mb-6 text-center">Admin Login</h2>

        {error && (
          <div className="text-red-600 mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1">User ID</label>
          <input
            name="userId"
            value={credentials.userId}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
            required
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1">Password</label>
          <input
            name="pwd"
            type="password"
            value={credentials.pwd}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}
