// src/components/Dashboard.jsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  ClipboardList
} from 'lucide-react';

function getCurrentRole() {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.userType) return String(parsed.userType).toLowerCase(); // 'a' | 'e' | 'd'
    }
  } catch {}
  const raw = localStorage.getItem('userType');
  return raw ? String(raw).toLowerCase() : 'a'; // default admin
}

const TILES = [
  { to: '/create-depot',           label: 'Create Depot',            icon: Building2,        roles: ['a'],      color: 'from-sky-500 to-sky-600' },
  { to: '/create-route',           label: 'Create Route',            icon: RouteIcon,        roles: ['a'],      color: 'from-emerald-500 to-emerald-600' },
  { to: '/create-order',           label: 'Create Order',            icon: Truck,            roles: ['a','e'],  color: 'from-indigo-500 to-indigo-600' },
  { to: '/list-order',             label: 'List Orders',             icon: ListOrdered,      roles: ['a','e'],  color: 'from-purple-500 to-purple-600' },
  { to: '/trip-manager',           label: 'Trip Manager',            icon: MapPinned,        roles: ['a','e'],  color: 'from-orange-500 to-orange-600' },
  { to: '/driver-trips',           label: 'Driver Trips',            icon: Car,              roles: ['d'],      color: 'from-rose-500 to-rose-600' },
  { to: '/driver-deliveries',      label: 'Driver Deliveries',       icon: ClipboardList,    roles: ['d'],      color: 'from-pink-500 to-pink-600' },
  { to: '/vehicle-master',         label: 'Vehicle Master',          icon: Car,              roles: ['a'],      color: 'from-teal-500 to-teal-600' },
  { to: '/customer-master',        label: 'Customer Master',         icon: Users,            roles: ['a'],      color: 'from-blue-500 to-blue-600' },
  { to: '/user-master',            label: 'User Master',             icon: UserCog,          roles: ['a'],      color: 'from-cyan-500 to-cyan-600' },
  { to: '/driver-master',          label: 'Driver Master',           icon: IdCard,           roles: ['a'],      color: 'from-lime-500 to-lime-600' },
  { to: '/employee-master',        label: 'Employee Master',         icon: BriefcaseBusiness,roles: ['a'],      color: 'from-amber-500 to-amber-600' },
  { to: '/loading-source-master',  label: 'Loading Source Master',   icon: Fuel,             roles: ['a'],      color: 'from-fuchsia-500 to-fuchsia-600' },
  { to: '/trip-listing',           label: 'Trip Listing',            icon: RouteIcon,        roles: ['a','e'],  color: 'from-slate-500 to-slate-600' },
];

export default function Dashboard() {
  const role = useMemo(getCurrentRole, []);
  const visibleTiles = useMemo(
    () => TILES.filter(t => t.roles.includes(role)),
    [role]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome to the Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Quick actions & tools based on your role.</p>
        </div>
        <RoleBadge role={role} />
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleTiles.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className={`
              group relative overflow-hidden rounded-xl
              bg-gradient-to-br ${color}
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
            {/* subtle bottom highlight */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {/* Empty-state if no tiles for role */}
      {visibleTiles.length === 0 && (
        <div className="mt-16 text-center text-gray-500">
          No actions available for your role.
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  const map = {
    a: { label: 'Admin',    className: 'bg-indigo-100 text-indigo-700' },
    e: { label: 'Executive',className: 'bg-emerald-100 text-emerald-700' },
    d: { label: 'Driver',   className: 'bg-amber-100 text-amber-700' }
  };
  const cfg = map[role] || map.a;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${cfg.className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}
