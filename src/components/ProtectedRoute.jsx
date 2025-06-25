// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
  const { user } = useAuth();
  // if no user, redirect to login
  if (!user) return <Navigate to="/login" replace />;
  // otherwise render whatever child route is matched
  return <Outlet />;
}
