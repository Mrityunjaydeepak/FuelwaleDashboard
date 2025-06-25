import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <NavBar />
      <main className="flex-1 p-6 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
