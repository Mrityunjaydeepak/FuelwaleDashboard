import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
 * - Root shows two tiles: "Masters" and "Operations".
 * - Clicking either switches to /?view=masters or /?view=operations.
 * - Small "Back" clears ?view (back to root).
 * - Individual tiles still navigate to their own routes (<Link/>).
 */

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
  return 'User';
}

function toTitle(s) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** ---------------- Categorized tiles ---------------- **/

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

// Operation screens (incl. driver + accounts if allowed)
const OPERATION_TILES = [
  { to: '/create-order',     label: 'Create Order',            icon: Truck,         roles: ['a','e'] },
  { to: '/list-order',       label: 'List Orders',             icon: ListOrdered,   roles: ['a','e'] },
  { to: '/trip-manager',     label: 'Trip Manager',            icon: MapPinned,     roles: ['a','e','tr'] },
  { to: '/trip-listing',     label: 'Trip Listing',            icon: RouteIcon,     roles: ['a','e','tr'] },
  { to: '/accounts',         label: 'Accounts: PAY/REC',       icon: Wallet,        roles: ['a','ac'] },
  // Driver-only ops
  { to: '/driver-trips',       label: 'Driver Trips',          icon: Car,           roles: ['d'] },
  { to: '/driver-deliveries',  label: 'Driver Deliveries',     icon: ClipboardList, roles: ['d'] }
];

// Gradient palette
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
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'root'; // 'root' | 'masters' | 'operations'

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

  const goRoot = () => setParams({}, { replace: false }); // clears ?view

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Welcome, {userName}!
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {view === 'root'
              ? 'Choose a category to continue.'
              : view === 'masters'
              ? 'Manage master data for your organization.'
              : 'Run day-to-day operational workflows.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view !== 'root' && (
            <button
              onClick={goRoot}
              className="mr-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-white shadow hover:shadow-md border"
              title="Back to Dashboard"
            >
              ← Back
            </button>
          )}
          <RoleBadge role={role} />
        </div>
      </header>

      {/* Root: two big buttons that navigate via URL to preserve history */}
      {view === 'root' && (
        <div className="grid gap-5 sm:grid-cols-2">
          {visibleMasters.length > 0 && (
            <Link
              to={{ pathname: '/', search: '?view=masters' }}
              className={tileButtonClass('from-indigo-500 to-indigo-600')}
            >
              <TileButtonInner icon={Blocks} title="Masters" desc="All master data screens" />
            </Link>
          )}

          {visibleOps.length > 0 && (
            <Link
              to={{ pathname: '/', search: '?view=operations' }}
              className={tileButtonClass('from-emerald-500 to-emerald-600')}
            >
              <TileButtonInner icon={Wrench} title="Operations" desc="Orders, trips, accounts and more" />
            </Link>
          )}
        </div>
      )}

      {/* Masters */}
      {view === 'masters' && (
        <>
          <TileGrid tiles={visibleMasters} />
          {visibleMasters.length === 0 && <EmptyForRole />}
        </>
      )}

      {/* Operations */}
      {view === 'operations' && (
        <>
          <TileGrid tiles={visibleOps} />
          {visibleOps.length === 0 && <EmptyForRole />}
        </>
      )}

      {/* Fallback when neither category is available */}
      {view === 'root' && visibleMasters.length === 0 && visibleOps.length === 0 && <EmptyForRole />}
    </div>
  );
}

/** ---------- Reusable UI bits ---------- **/

function tileButtonClass(gradient) {
  return `
    group relative overflow-hidden rounded-xl
    bg-gradient-to-br ${gradient}
    text-white
    shadow hover:shadow-lg transition-all
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
    text-left
  `;
}

function TileButtonInner({ icon: Icon, title, desc }) {
  return (
    <div className="p-5 flex items-center gap-4 w-full">
      <div className="rounded-lg bg-white/15 p-3 backdrop-blur-sm group-hover:scale-105 transition-transform">
        <Icon size={26} />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-white/80 text-xs mt-0.5">{desc}</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function TileGrid({ tiles }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map(({ to, label, icon: Icon }, idx) => (
        <Link
          key={to}
          to={to}
          className={`
            group relative overflow-hidden rounded-xl
            bg-gradient-to-br ${COLORS[idx % COLORS.length]}
            text-white
            shadow hover:shadow-lg transition-all
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
          `}
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
    <div className="mt-16 text-center text-gray-500">
      No actions available for your role.
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
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${cfg.className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}
