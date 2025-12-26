// src/components/Dashboard.jsx
import React, { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

function getCurrentRole() {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.userType) return String(parsed.userType).toLowerCase();
    }
  } catch {
    // ignore
  }
  const raw = localStorage.getItem('userType');
  return raw ? String(raw).toLowerCase() : 'a';
}

function toTitle(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getCurrentUserName() {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      const candidates = [
        u?.name,
        u?.displayName,
        u?.fullName,
        u?.employee?.empName,
        u?.customer?.custName,
        u?.driver?.driverName,
        u?.userId,
        u?.mobileNo,
        u?.empCd,
      ].filter(Boolean);
      if (candidates[0]) return toTitle(String(candidates[0]));
    }
  } catch {
    // ignore
  }
  const fallback = localStorage.getItem('username') || localStorage.getItem('empCd');
  return fallback ? toTitle(fallback) : 'Md100';
}

function roleLabel(role) {
  const map = {
    a: 'Admin',
    e: 'Executive',
    d: 'Driver',
    va: 'Vehicle Alloc',
    tr: 'Trips',
    ac: 'Accounts',
  };
  return map[role] || 'Admin';
}

const MASTER_ACTIONS = [
  { to: '/create-depot', label: 'DEPOT', roles: ['a'] },
  { to: '/employee-master', label: 'USERS', roles: ['a'] },
  { to: '/customer-master', label: 'CUSTOMER', roles: ['a'] },
  { to: '/vehicle-master', label: 'VEHICLE', roles: ['a'] },
  { to: '/create-route', label: 'DELIVERY ROUTE', roles: ['a'] },
  { to: '/user-master', label: 'CREDENTIALS', roles: ['a'] },
  { to: '/loading-source-master', label: 'PRODUCTS', roles: ['a'] },
  { to: '/driver-master', label: 'DRIVER', roles: ['a'] },
];

const OPERATION_ACTIONS = [
  { to: '/create-order', label: 'CREATE ORDER', roles: ['a', 'e'] },
  { to: '/list-order', label: 'ORDER LIST', roles: ['a', 'e'] },
  { to: '/trip-manager', label: 'TRIP MANAGER', roles: ['a', 'e', 'tr'] },
  { to: '/trip-listing', label: 'TRIP LISTING', roles: ['a', 'e', 'tr'] },
  { to: '/fleet-listing', label: 'FLEET MANAGER', roles: ['a', 'ac'] },
  { to: '/accounts', label: 'ACCOUNTS: PAY/REC', roles: ['a', 'ac'] },
  { to: '/driver-trips', label: 'DRIVER TRIPS', roles: ['d'] },
  { to: '/driver-deliveries', label: 'DRIVER DELIVERIES', roles: ['d'] },
];

const ACCOUNTS_ACTIONS = [
  { to: '/accounts', label: 'ACCOUNTS: PAY/REC', roles: ['a', 'ac'] },
  { to: '/fleet-listing', label: 'FLEET MANAGER', roles: ['a', 'ac'] },
];

const REPORT_ACTIONS = [
  { to: '/trip-listing', label: 'TRIP LISTING', roles: ['a', 'e', 'tr', 'ac'] },
  { to: '/list-order', label: 'ORDER REPORTS', roles: ['a', 'e', 'ac'] },
];

function filterByRole(actions, role) {
  return actions.filter((a) => a.roles.includes(role));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'root'; // root | masters | operations | accounts | reports

  const role = useMemo(getCurrentRole, []);
  const userName = useMemo(getCurrentUserName, []);

  const masters = useMemo(() => filterByRole(MASTER_ACTIONS, role), [role]);
  const operations = useMemo(() => filterByRole(OPERATION_ACTIONS, role), [role]);
  const accounts = useMemo(() => filterByRole(ACCOUNTS_ACTIONS, role), [role]);
  const reports = useMemo(() => filterByRole(REPORT_ACTIONS, role), [role]);

  const sections = useMemo(() => {
    const list = [];
    if (masters.length) list.push({ key: 'masters', label: 'MASTERS' });
    if (operations.length) list.push({ key: 'operations', label: 'OPERATION' });
    if (accounts.length) list.push({ key: 'accounts', label: 'ACCOUNTS' });
    if (reports.length) list.push({ key: 'reports', label: 'REPORTS' });
    return list;
  }, [masters.length, operations.length, accounts.length, reports.length]);

  const setView = (v) => {
    if (!v || v === 'root') setParams({}, { replace: true });
    else setParams({ view: v }, { replace: true });
  };

  const handleHome = () => setView('root');

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
    if (view === 'masters') return { leftLabel: 'MASTERS', actions: masters };
    if (view === 'operations') return { leftLabel: 'OPERATION', actions: operations };
    if (view === 'accounts') return { leftLabel: 'ACCOUNTS', actions: accounts };
    if (view === 'reports') return { leftLabel: 'REPORTS', actions: reports };
    return {
      leftLabel: 'DASHBOARD',
      actions: sections.map((s) => ({ to: `?view=${s.key}`, label: s.label, isSection: true })),
    };
  }, [view, masters, operations, accounts, reports, sections]);

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto bg-white border border-gray-300 shadow-sm min-h-[80vh] flex flex-col">
        {/* Top row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300">
          <div className="text-sm">
            <span>Welcome. </span>
            <span className="font-semibold">{userName}!</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHome}
              className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-semibold border border-gray-600 shadow-sm"
            >
              Home
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-semibold border border-gray-600 shadow-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-semibold border border-gray-600 shadow-sm"
            >
              Log Out
            </button>
            <span className="ml-2 text-red-600 font-semibold">{roleLabel(role)}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
          <ExcelLikeView
            leftLabel={current.leftLabel}
            actions={current.actions}
            view={view}
            onSetView={setView}
          />
        </div>
      </div>
    </div>
  );
}

function ExcelLikeView({ leftLabel, actions, view, onSetView }) {
  return (
    <div className="h-full flex flex-col md:flex-row items-center md:items-start justify-center md:justify-between gap-10">
      {/* Left big label */}
      <div className="w-full md:w-[42%] flex items-center justify-center">
        <div className="w-full max-w-md h-32 md:h-40 rounded-2xl border-2 border-[#2b2b2b] bg-[#52a935] shadow-sm flex items-center justify-center">
          <div className="text-white text-2xl md:text-3xl font-extrabold tracking-wide">
            {leftLabel}
          </div>
        </div>
      </div>

      {/* Right buttons + logo */}
      <div className="w-full md:w-[58%] flex flex-col items-center">
        <div className="w-full flex justify-end mb-6">
          <div className="select-none text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-orange-600">fuel</span>
            <span className="text-purple-700">wale</span>
          </div>
        </div>

        <div className="w-full max-w-lg flex flex-col gap-5">
          {actions.map((a) => {
            if (a.isSection) {
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => onSetView(a.to.replace('?view=', ''))}
                  className={rightButtonClass()}
                >
                  {a.label}
                </button>
              );
            }

            return (
              <Link key={a.to} to={a.to} className={rightButtonClass()}>
                {a.label}
              </Link>
            );
          })}

          {view !== 'root' && (
            <button type="button" onClick={() => onSetView('root')} className={rightButtonClass()}>
              BACK TO MENU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function rightButtonClass() {
  return `
    w-full
    text-center
    py-4
    rounded-2xl
    bg-[#1698c7]
    text-white
    font-extrabold
    tracking-wide
    border-2
    border-[#084253]
    shadow-sm
    hover:bg-[#138bb7]
    transition-colors
  `;
}
