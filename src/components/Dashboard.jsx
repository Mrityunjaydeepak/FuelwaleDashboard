// src/components/Dashboard.jsx
import React, { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getCurrentRoleCode() {
  const u = safeJsonParse(localStorage.getItem('user') || '');
  const fromUser = u?.userType ?? u?.role ?? u?.userRole ?? null;
  if (fromUser) return String(fromUser).toLowerCase();
  const raw = localStorage.getItem('userType') || localStorage.getItem('role') || '';
  return raw ? String(raw).toLowerCase() : 'a';
}

function roleLabel(roleCode) {
  const map = {
    a: 'Admin',
    e: 'Executive',
    d: 'Driver',
    va: 'Vehicle Alloc',
    tr: 'Trips',
    ac: 'Accounts',
  };
  return map[roleCode] || 'Admin';
}

function getCurrentUserId() {
  const u = safeJsonParse(localStorage.getItem('user') || '');
  const candidates = [
    u?.userId,
    u?.empCd,
    u?.employeeId,
    u?.username,
    u?.loginId,
    u?.mobileNo,
    localStorage.getItem('userId'),
    localStorage.getItem('empCd'),
    localStorage.getItem('username'),
  ].filter(Boolean);

  return candidates.length ? String(candidates[0]) : 'Md100';
}

const SECTIONS = [
  { key: 'masters', label: 'MASTERS' },
  { key: 'operations', label: 'OPERATION' },
  { key: 'accounts', label: 'ACCOUNTS' },
  { key: 'reports', label: 'REPORTS' },
];

const MASTERS_ACTIONS = [
  { to: '/create-depot', label: 'CREATE DEPOT', roles: ['a'] },
  { to: '/employee-master', label: 'CREATE USERS', roles: ['a'] },
  { to: '/customer-master', label: 'CREATE CUSTOMER', roles: ['a'] },
  { to: '/vehicle-master', label: 'CREATE VEHICLE', roles: ['a'] },
  { to: '/create-route', label: 'CREATE DELIVERY ROUTE', roles: ['a'] },
  { to: '/loading-source-master', label: 'CREATE PRODUCTS', roles: ['a'] },
  { to: '/driver-master', label: 'CREATE DRIVER', roles: ['a'] },
];

const OPERATIONS_ACTIONS = [
  { to: '/create-order', label: 'CREATE ORDER', roles: ['a', 'e'] },
  { to: '/list-order', label: 'ORDER LIST', roles: ['a', 'e'] },
  { to: '/trip-manager', label: 'TRIP MANAGER', roles: ['a', 'e', 'tr'] },
  { to: '/driver-trips', label: 'DRIVER TRIPS', roles: ['d'] },
  { to: '/driver-deliveries', label: 'DRIVER DELIVERIES', roles: ['d'] },
];

const ACCOUNTS_ACTIONS = [
  { to: '/accounts', label: 'PAY / REC', roles: ['a', 'ac'] },
  { to: '/fleet-listing', label: 'FLEET MANAGER', roles: ['a', 'ac'] },
];

const REPORTS_ACTIONS = [
  { to: '/trip-listing', label: 'TRIP REPORTS', roles: ['a', 'e', 'tr', 'ac'] },
  { to: '/list-order', label: 'ORDER REPORTS', roles: ['a', 'e', 'ac'] },
];

function filterByRole(actions, roleCode) {
  return actions.filter((a) => a.roles.includes(roleCode));
}

function normalizeView(v) {
  const allowed = new Set(['root', 'masters', 'operations', 'accounts', 'reports']);
  return allowed.has(v) ? v : 'root';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = normalizeView(params.get('view') || 'root');

  const roleCode = useMemo(getCurrentRoleCode, []);
  const roleText = useMemo(() => roleLabel(roleCode), [roleCode]);
  const userId = useMemo(getCurrentUserId, []);

  const masters = useMemo(() => filterByRole(MASTERS_ACTIONS, roleCode), [roleCode]);
  const operations = useMemo(() => filterByRole(OPERATIONS_ACTIONS, roleCode), [roleCode]);
  const accounts = useMemo(() => filterByRole(ACCOUNTS_ACTIONS, roleCode), [roleCode]);
  const reports = useMemo(() => filterByRole(REPORTS_ACTIONS, roleCode), [roleCode]);

  const visibleSections = useMemo(() => {
    const s = [];
    if (masters.length) s.push({ key: 'masters', label: 'MASTERS' });
    if (operations.length) s.push({ key: 'operations', label: 'OPERATION' });
    if (accounts.length) s.push({ key: 'accounts', label: 'ACCOUNTS' });
    if (reports.length) s.push({ key: 'reports', label: 'REPORTS' });
    return s.length ? s : SECTIONS;
  }, [masters.length, operations.length, accounts.length, reports.length]);

  const setView = (v) => {
    const next = normalizeView(v || 'root');
    if (next === 'root') setParams({}, { replace: true });
    else setParams({ view: next }, { replace: true });
  };

  const handleHome = () => {
    setView('root');
    navigate('/dashboard');
  };

  const handleBack = () => {
    if (view !== 'root') setView('root');
    else navigate(-1);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  const current = useMemo(() => {
    if (view === 'masters') return { title: 'MASTERS', actions: masters };
    if (view === 'operations') return { title: 'OPERATION', actions: operations };
    if (view === 'accounts') return { title: 'ACCOUNTS', actions: accounts };
    if (view === 'reports') return { title: 'REPORTS', actions: reports };
    return {
      title: 'DASHBOARD',
      actions: visibleSections.map((s) => ({ isSection: true, key: s.key, label: s.label })),
    };
  }, [view, masters, operations, accounts, reports, visibleSections]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 px-3 py-6 sm:px-6">
      <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl border border-blue-100/50 shadow-2xl rounded-3xl overflow-hidden">
        <TopBar userId={userId} roleText={roleText} onHome={handleHome} onBack={handleBack} onLogout={handleLogout} />

        <div className="px-4 py-6 sm:px-8 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            <aside className="lg:col-span-4">
              <div className="h-full rounded-2xl border border-blue-200 bg-white/50 backdrop-blur-sm shadow-sm p-5 flex flex-col">
                <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg px-5 py-8 flex items-center justify-center">
                  <div className="text-white text-2xl sm:text-3xl font-black tracking-wide text-center drop-shadow-lg">
                    {current.title}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-xs font-bold text-gray-700 tracking-wide uppercase mb-3 bg-blue-50 px-3 py-1 rounded-xl inline-block">
                    Sections
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {visibleSections.map((s) => {
                      const active = view === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setView(s.key)}
                          className={[
                            'group rounded-xl border-2 font-black tracking-wide py-3 text-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                            active
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25'
                              : 'bg-white/70 text-blue-700 border-blue-300 hover:border-blue-400 hover:bg-white backdrop-blur-sm',
                          ].join(' ')}
                        >
                          <span className="block">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {view !== 'root' && (
                    <button
                      type="button"
                      onClick={() => setView('root')}
                      className="mt-6 w-full rounded-xl border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-black tracking-wide py-3 hover:bg-white hover:border-blue-500 hover:shadow-md transition-all duration-300 backdrop-blur-sm"
                    >
                      ← BACK TO MENU
                    </button>
                  )}
                </div>
              </div>
            </aside>

            <main className="lg:col-span-8">
              <div className="h-full rounded-2xl border border-blue-200 bg-white/50 backdrop-blur-sm shadow-sm p-5 sm:p-6 flex flex-col">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <LogoMark />
                  <div className="text-xs sm:text-sm text-gray-600 font-medium bg-blue-50/50 px-4 py-2 rounded-xl backdrop-blur-sm">
                    {view === 'root' ? 'Select a section to continue' : 'Select an action'}
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  <ActionGrid
                    view={view}
                    actions={current.actions}
                    onSelectSection={(k) => setView(k)}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ userId, roleText, onHome, onBack, onLogout }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-blue-200 bg-gradient-to-r from-blue-500/10 to-indigo-600/10 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="text-sm sm:text-base bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-blue-200/50">
          <span className="text-blue-800 font-medium">Welcome.</span>{' '}
          <span className="font-black text-blue-900 drop-shadow-sm">{userId}!</span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2">
        <div className="px-3 py-2 bg-red-50/50 border border-red-200 rounded-xl text-red-700 font-bold text-sm backdrop-blur-sm">
          {roleText}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={onHome} className={topBtnClass()}>
            <span className="hidden sm:inline">Home</span>
            <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button type="button" onClick={onBack} className={topBtnClass()}>
            <span className="hidden sm:inline">Back</span>
            <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={onLogout} className={topBtnClass()}>
            <span className="hidden sm:inline">Log Out</span>
            <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function topBtnClass() {
  return `
    px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 
    text-white font-black tracking-wide border border-blue-600/50 shadow-lg 
    hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:scale-105 
    active:scale-95 transition-all duration-300 text-xs sm:text-sm backdrop-blur-sm
  `;
}

function LogoMark() {
  return (
    <div className="select-none text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-700 to-blue-800 bg-clip-text text-transparent drop-shadow-lg">
      Fuelwale
    </div>
  );
}

function ActionGrid({ view, actions, onSelectSection }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="h-full min-h-[240px] flex items-center justify-center text-gray-500 font-semibold bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl p-8 backdrop-blur-sm">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          No actions available for your role
        </div>
      </div>
    );
  }

  const isRoot = view === 'root';

  return (
    <div className={isRoot ? 'grid grid-cols-1 sm:grid-cols-2 gap-6' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6'}>
      {actions.map((a) => {
        if (a.isSection) {
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelectSection(a.key)}
              className={actionBtnClass(true)}
            >
              <div className="w-12 h-12 mx-auto mb-3 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {a.key === 'masters' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
                  {a.key === 'operations' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {a.key === 'accounts' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {a.key === 'reports' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
                </svg>
              </div>
              <div>{a.label}</div>
            </button>
          );
        }

        return (
          <Link key={a.to} to={a.to} className={actionBtnClass(false)}>
            <div className="w-12 h-12 mx-auto mb-3 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>{a.label}</div>
          </Link>
        );
      })}
    </div>
  );
}

function actionBtnClass(isSection) {
  return `
    w-full text-center py-6 px-4 rounded-2xl bg-gradient-to-br from-blue-500/90 via-blue-600/90 to-indigo-600/90
    text-white font-black tracking-wide border-2 border-blue-500/50 shadow-xl backdrop-blur-sm
    hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 hover:shadow-2xl hover:border-blue-400
    hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 focus:outline-none
    focus:ring-4 focus:ring-blue-500/30 focus:ring-offset-2 focus:ring-offset-blue-50
  `;
}
