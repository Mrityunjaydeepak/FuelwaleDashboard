import React, { useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Route as RouteIcon,
  Truck,
  ListOrdered,
  MapPinned,
  Car,
  Users,
  UserCog,
  IdCard,
  BriefcaseBusiness,
  Fuel,
  ClipboardList,
  Blocks,
  Wrench,
  Wallet
} from 'lucide-react';

/**
 * Dashboard with URL-driven sub-views:
 * - Root (no ?view) shows the Excel-like screen:
 *   left vertical buttons (MASTERS / OPERATION / ACCOUNTS / REPORTS),
 *   right logo, top-right Home/Back/Log Out/Admin.
 * - Clicking a left button sets ?view=masters / operations / accounts / reports.
 * - Each view shows gradient tile grid for its section using the existing theme.
 */

/* ---------- Helpers to read current user/role ---------- */

function getCurrentRole() {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.userType) return String(parsed.userType).toLowerCase(); // a | e | d | va | tr | ac
    }
  } catch {}
  const raw = localStorage.getItem('userType');
  return raw ? String(raw).toLowerCase() : 'a'; // default admin
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
        u?.mobileNo
      ].filter(Boolean);
      const raw = candidates[0];
      if (raw) return toTitle(String(raw));
    }
  } catch {}
  return 'Md100'; // fallback like your screenshot
}

function toTitle(s) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ---------- Tile configuration ---------- */

// Master screens
const MASTER_TILES = [
  { to: '/create-depot',           label: 'Create Depot',            icon: Building2,          roles: ['a'] },
  { to: '/create-route',           label: 'Create Route',            icon: RouteIcon,          roles: ['a'] },
  { to: '/vehicle-master',         label: 'Vehicle Master',          icon: Car,                roles: ['a'] },
  { to: '/customer-master',        label: 'Customer Master',         icon: Users,              roles: ['a'] },
  { to: '/user-master',            label: 'Credential Master',       icon: UserCog,            roles: ['a'] },
  { to: '/driver-master',          label: 'Driver Master',           icon: IdCard,             roles: ['a'] },
  { to: '/employee-master',        label: 'Employee Master',         icon: BriefcaseBusiness,  roles: ['a'] },
  { to: '/loading-source-master',  label: 'Loading Source Master',   icon: Fuel,               roles: ['a'] }
];

// Operation screens
const OPERATION_TILES = [
  { to: '/create-order',     label: 'Create Order',            icon: Truck,         roles: ['a','e'] },
  { to: '/list-order',       label: 'List Orders',             icon: ListOrdered,   roles: ['a','e'] },
  { to: '/trip-manager',     label: 'Trip Manager',            icon: MapPinned,     roles: ['a','e','tr'] },
  { to: '/trip-listing',     label: 'Trip Listing',            icon: RouteIcon,     roles: ['a','e','tr'] },
  { to: '/accounts',         label: 'Accounts: PAY/REC',       icon: Wallet,        roles: ['a','ac'] },
  { to: '/fleet-listing',    label: 'Fleet Manager',           icon: Truck,         roles: ['a','ac'] },

  // Driver-only ops
  { to: '/driver-trips',       label: 'Driver Trips',          icon: Car,           roles: ['d'] },
  { to: '/driver-deliveries',  label: 'Driver Deliveries',     icon: ClipboardList, roles: ['d'] }
];

// Dedicated accounts section (can be expanded later)
const ACCOUNTS_TILES = [
  { to: '/accounts',      label: 'Accounts: PAY/REC',   icon: Wallet,  roles: ['a','ac'] },
  { to: '/fleet-listing', label: 'Fleet Manager',       icon: Truck,   roles: ['a','ac'] }
];

// Simple reports section (you can adjust routes/titles)
const REPORT_TILES = [
  { to: '/trip-listing', label: 'Trip Listing',     icon: RouteIcon,     roles: ['a','e','tr','ac'] },
  { to: '/list-order',   label: 'Order Reports',    icon: ClipboardList, roles: ['a','e','ac'] }
];

// Gradient palette for tiles
const COLORS = [
  'from-indigo-500 to-indigo-600',
  'from-emerald-500 to-emerald-600',
  'from-sky-500 to-sky-600',
  'from-orange-500 to-orange-600',
  'from-purple-500 to-purple-600',
  'from-teal-500 to-teal-600',
  'from-cyan-500 to-cyan-600',
  'from-amber-500 to-amber-600',
  'from-pink-500 to-pink-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-lime-500 to-lime-600',
  'from-slate-500 to-slate-600'
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'root'; // 'root' | 'masters' | 'operations' | 'accounts' | 'reports'

  const role = useMemo(getCurrentRole, []);
  const userName = useMemo(getCurrentUserName, []);

  const visibleMasters = useMemo(
    () => MASTER_TILES.filter(t => t.roles.includes(role)),
    [role]
  );
  const visibleOps = useMemo(
    () => OPERATION_TILES.filter(t => t.roles.includes(role)),
    [role]
  );
  const visibleAccounts = useMemo(
    () => ACCOUNTS_TILES.filter(t => t.roles.includes(role)),
    [role]
  );
  const visibleReports = useMemo(
    () => REPORT_TILES.filter(t => t.roles.includes(role)),
    [role]
  );

  const setView = (v) => {
    if (!v || v === 'root') {
      setParams({}, { replace: true });
    } else {
      setParams({ view: v }, { replace: true });
    }
  };

  /* ---------- Top nav handlers ---------- */

  const handleHome = () => {
    navigate('/dashboard');
    setView('root');
  };

  const handleBack = () => {
    if (view !== 'root') {
      setView('root');
    } else {
      navigate(-1);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  /* ---------- Render ---------- */

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto bg-white border border-gray-300 shadow-sm min-h-[80vh] flex flex-col">
        {/* Top row: Welcome + nav buttons */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span>Welcome: <span className="font-semibold">{userName}!</span></span>
            <RoleBadge role={role} />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleHome}
              className="px-4 py-1 border border-gray-500 rounded-sm text-[11px] sm:text-xs bg-orange-500 text-white hover:bg-orange-600"
            >
              Home
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-1 border border-gray-500 rounded-sm text-[11px] sm:text-xs bg-orange-500 text-white hover:bg-orange-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1 border border-gray-500 rounded-sm text-[11px] sm:text-xs bg-orange-500 text-white hover:bg-orange-600"
            >
              Log Out
            </button>
            <button
              type="button"
              className="px-4 py-1 text-[11px] sm:text-xs text-red-600 underline"
            >
              Admin
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 p-6">
          {/* ROOT VIEW: Excel-style dashboard */}
          {view === 'root' && (
            <div className="h-full flex flex-col md:flex-row items-center md:items-start justify-center md:justify-between gap-10">
              {/* Left vertical menu buttons */}
              <div className="flex flex-col gap-4 w-full md:w-auto max-w-xs">
                <DashMenuButton label="MASTERS" onClick={() => setView('masters')} />
                <DashMenuButton label="OPERATION" onClick={() => setView('operations')} />
                <DashMenuButton label="ACCOUNTS" onClick={() => setView('accounts')} />
                <DashMenuButton label="REPORTS" onClick={() => setView('reports')} />
              </div>

              {/* Right logo area */}
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="w-full max-w-md aspect-video flex items-center justify-center bg-white border border-gray-300 rounded-lg shadow-sm">
                  {/* Replace this with your actual logo image */}
                  {/* <img src="/images/fuelwale-logo.png" alt="fuelwale" className="max-h-full max-w-full object-contain" /> */}
                  <div className="text-4xl sm:text-5xl font-bold tracking-tight">
                    <span className="text-orange-600">fuel</span>
                    <span className="text-purple-700">wale</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MASTERS VIEW */}
          {view === 'masters' && (
            <SectionWithTitle
              title="MASTERS"
              subtitle="Manage master data for your organization."
            >
              {visibleMasters.length > 0 ? (
                <TileGrid tiles={visibleMasters} />
              ) : (
                <EmptyForRole />
              )}
            </SectionWithTitle>
          )}

          {/* OPERATIONS VIEW */}
          {view === 'operations' && (
            <SectionWithTitle
              title="OPERATION"
              subtitle="Run day-to-day operational workflows."
            >
              {visibleOps.length > 0 ? (
                <TileGrid tiles={visibleOps} />
              ) : (
                <EmptyForRole />
              )}
            </SectionWithTitle>
          )}

          {/* ACCOUNTS VIEW */}
          {view === 'accounts' && (
            <SectionWithTitle
              title="ACCOUNTS"
              subtitle="Accounts and related operations."
            >
              {visibleAccounts.length > 0 ? (
                <TileGrid tiles={visibleAccounts} />
              ) : (
                <EmptyForRole />
              )}
            </SectionWithTitle>
          )}

          {/* REPORTS VIEW */}
          {view === 'reports' && (
            <SectionWithTitle
              title="REPORTS"
              subtitle="View and analyze operational reports."
            >
              {visibleReports.length > 0 ? (
                <TileGrid tiles={visibleReports} />
              ) : (
                <EmptyForRole />
              )}
            </SectionWithTitle>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable UI pieces ---------- */

function DashMenuButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full px-8 py-3
        bg-[#0d6078] text-white
        rounded-full
        text-lg font-semibold tracking-wide
        shadow
        border border-[#084253]
        hover:bg-[#0f6f8b]
        transition-colors
      "
    >
      {label}
    </button>
  );
}

function SectionWithTitle({ title, subtitle, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}

function tileButtonClass(gradient) {
  return `
    group relative overflow-hidden rounded-xl
    bg-gradient-to-br ${gradient}
    text-white
    shadow hover:shadow-lg transition-all
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
  `;
}

function TileGrid({ tiles }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map(({ to, label, icon: Icon }, idx) => (
        <Link
          key={to}
          to={to}
          className={tileButtonClass(COLORS[idx % COLORS.length])}
        >
          <div className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-white/15 p-3 backdrop-blur-sm group-hover:scale-105 transition-transform">
              <Icon size={26} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{label}</div>
              <div className="text-white/80 text-xs mt-0.5">Go to {label}</div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

function EmptyForRole() {
  return (
    <div className="py-10 text-center text-gray-500 text-sm">
      No actions available for your role in this section.
    </div>
  );
}

function RoleBadge({ role }) {
  const map = {
    a:  { label: 'Admin',        className: 'bg-indigo-100 text-indigo-700' },
    e:  { label: 'Executive',    className: 'bg-emerald-100 text-emerald-700' },
    d:  { label: 'Driver',       className: 'bg-amber-100 text-amber-700' },
    va: { label: 'Vehicle Alloc',className: 'bg-sky-100 text-sky-700' },
    tr: { label: 'Trips',        className: 'bg-purple-100 text-purple-700' },
    ac: { label: 'Accounts',     className: 'bg-rose-100 text-rose-700' }
  };
  const cfg = map[role] || map.a;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] sm:text-xs ${cfg.className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}
