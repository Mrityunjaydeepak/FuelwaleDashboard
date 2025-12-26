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
  { to: '/user-master', label: 'CREATE CREDENTIALS', roles: ['a'] },
  { to: '/loading-source-master', label: 'CREATE PRODUCTS', roles: ['a'] },
  { to: '/driver-master', label: 'CREATE DRIVER', roles: ['a'] },
];

const OPERATIONS_ACTIONS = [
  { to: '/create-order', label: 'CREATE ORDER', roles: ['a', 'e'] },
  { to: '/list-order', label: 'ORDER LIST', roles: ['a', 'e'] },
  { to: '/trip-manager', label: 'TRIP MANAGER', roles: ['a', 'e', 'tr'] },
  { to: '/trip-listing', label: 'TRIP LISTING', roles: ['a', 'e', 'tr'] },
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
    <div className="min-h-screen bg-gray-100 px-3 py-6 sm:px-6">
      <div className="max-w-6xl mx-auto bg-white border border-gray-300 shadow-sm rounded-xl overflow-hidden">
        <TopBar userId={userId} roleText={roleText} onHome={handleHome} onBack={handleBack} onLogout={handleLogout} />

        <div className="px-4 py-6 sm:px-8 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            <aside className="lg:col-span-4">
              <div className="h-full rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col">
                <div className="rounded-2xl border-2 border-[#2b2b2b] bg-[#52a935] shadow-sm px-5 py-8 flex items-center justify-center">
                  <div className="text-white text-2xl sm:text-3xl font-extrabold tracking-wide text-center">
                    {current.title}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-xs font-semibold text-gray-500 tracking-wide uppercase mb-3">
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
                            'rounded-xl border-2 font-extrabold tracking-wide py-3 text-sm',
                            active
                              ? 'bg-[#0d6078] text-white border-[#084253] shadow-sm'
                              : 'bg-white text-[#0d6078] border-[#0d6078] hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {view !== 'root' && (
                    <button
                      type="button"
                      onClick={() => setView('root')}
                      className="mt-4 w-full rounded-xl border-2 border-[#0d6078] bg-white text-[#0d6078] font-extrabold tracking-wide py-3 hover:bg-gray-50"
                    >
                      BACK TO MENU
                    </button>
                  )}
                </div>
              </div>
            </aside>

            <main className="lg:col-span-8">
              <div className="h-full rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6 flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <LogoMark />
                  <div className="text-xs sm:text-sm text-gray-500">
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-300 bg-white">
      <div className="flex items-center gap-3">
        <div className="text-sm sm:text-base">
          <span className="text-gray-700">Welcome. </span>
          <span className="font-semibold text-gray-900">{userId}!</span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3">
        <div className="text-red-600 font-semibold underline">{roleText}</div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onHome} className={topBtnClass()}>
            Home
          </button>
          <button type="button" onClick={onBack} className={topBtnClass()}>
            Back
          </button>
          <button type="button" onClick={onLogout} className={topBtnClass()}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

function topBtnClass() {
  return 'px-5 py-2 rounded-lg bg-[#b85a1d] text-white font-extrabold tracking-wide border border-gray-600 shadow-sm hover:bg-[#a95018] transition-colors text-sm';
}

function LogoMark() {
  return (
    <div className="select-none text-3xl sm:text-4xl font-extrabold tracking-tight">
      <span className="text-orange-600">fuel</span>
      <span className="text-purple-700">wale</span>
    </div>
  );
}

function ActionGrid({ view, actions, onSelectSection }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="h-full min-h-[240px] flex items-center justify-center text-gray-500 font-semibold">
        No actions available.
      </div>
    );
  }

  const isRoot = view === 'root';

  return (
    <div className={isRoot ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4'}>
      {actions.map((a) => {
        if (a.isSection) {
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelectSection(a.key)}
              className={actionBtnClass()}
            >
              {a.label}
            </button>
          );
        }

        return (
          <Link key={a.to} to={a.to} className={actionBtnClass()}>
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

function actionBtnClass() {
  return `
    w-full
    text-center
    py-5
    rounded-2xl
    bg-[#1698c7]
    text-white
    font-extrabold
    tracking-wide
    border-2
    border-[#084253]
    shadow-sm
    hover:bg-[#138bb7]
    hover:shadow
    transition-all
    focus:outline-none
    focus:ring-2
    focus:ring-offset-2
    focus:ring-[#1698c7]
  `;
}
