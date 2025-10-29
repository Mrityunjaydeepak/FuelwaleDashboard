// src/components/NavBar.jsx
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const atRoot = location.pathname === '/';

  const goBack = () => {
    if (!atRoot) navigate(-1);
  };

  return (
    <div
      className={[
        'fixed top-3 left-0 right-0 z-50',
        'flex justify-center',
        'pointer-events-none'
      ].join(' ')}
    >
      <nav
        className={[
          'pointer-events-auto',
          // width constraint (reduce width here)
          'w-full max-w-xl sm:max-w-2xl', // <— tighten/loosen here
          'mx-3', // small side gutters on tiny screens
          // Glass look
          'backdrop-blur-md bg-white/10 dark:bg-slate-900/30',
          'border border-white/20 shadow-lg shadow-black/10',
          'rounded-2xl px-3 sm:px-4 h-12',
          'flex items-center justify-between',
        ].join(' ')}
        aria-label="Primary"
      >
        {/* Left: Home */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            [
              'inline-flex items-center gap-2 rounded-xl',
              'px-3 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-white text-slate-900'
                : 'text-white/90 hover:bg-white/10'
            ].join(' ')
          }
          title="Go to Dashboard"
        >
          <Home size={18} />
          <span className="hidden sm:inline">Home</span>
        </NavLink>

        {/* Center: Brand */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-white/80 select-none">
            FuelWale
          </div>
        </div>

        {/* Right: Back */}
        <button
          type="button"
          onClick={goBack}
          disabled={atRoot}
          className={[
            'inline-flex items-center gap-2 rounded-xl',
            'px-3 py-2 text-sm font-medium transition',
            atRoot
              ? 'text-white/40 cursor-not-allowed'
              : 'text-white/90 hover:bg-white/10'
          ].join(' ')}
          title={atRoot ? 'Already on Dashboard' : 'Go Back'}
        >
          <span className="hidden sm:inline">Back</span>
          <ArrowLeft size={18} />
        </button>
      </nav>
    </div>
  );
}
