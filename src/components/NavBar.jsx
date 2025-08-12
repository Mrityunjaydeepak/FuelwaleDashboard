// src/components/NavBar.jsx
import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Building2,
  Route as RouteIcon,
  Truck,
  ClipboardList,
  MapPinned,
  Car,
  Users,
  UserCog,
  IdCard,
  BriefcaseBusiness,
  Fuel,
  LogOut,
  ChevronLeft,
  Menu
} from 'lucide-react';

function roleOf(user) {
  // normalize to 'a' | 'e' | 'd'
  const raw = (user?.userType || '').toString().toLowerCase();
  if (['a', 'e', 'd'].includes(raw)) return raw;
  return 'a';
}

// Define your nav in one place (roles: 'a' admin, 'e' executive, 'd' driver)
const NAV_GROUPS = [
  {
    heading: 'Overview',
    items: [
      { to: '/',                 label: 'Dashboard',              icon: Home,           roles: ['a','e','d'] },
    ]
  },
  {
    heading: 'Operations',
    items: [
      { to: '/create-order',     label: 'Create Order',           icon: Truck,          roles: ['a','e'] },
      { to: '/list-order',       label: 'List Orders',            icon: ClipboardList,  roles: ['a','e'] },
      { to: '/trip-manager',     label: 'Trip Manager',           icon: MapPinned,      roles: ['a','e'] },
      { to: '/trip-listing',     label: 'Trip Listing',           icon: RouteIcon,      roles: ['a','e'] },
      { to: '/driver-trips',     label: 'Driver Trips',           icon: Car,            roles: ['d'] },
      { to: '/driver-deliveries',label: 'Driver Deliveries',      icon: ClipboardList,  roles: ['d'] },
    ]
  },
  {
    heading: 'Masters',
    items: [
      { to: '/create-depot',           label: 'Create Depot',           icon: Building2,        roles: ['a'] },
      { to: '/create-route',           label: 'Create Route',           icon: RouteIcon,        roles: ['a'] },
      { to: '/vehicle-master',         label: 'Vehicle Master',         icon: Car,              roles: ['a'] },
      { to: '/customer-master',        label: 'Customer Master',        icon: Users,            roles: ['a'] },
      { to: '/user-master',            label: 'User Master',            icon: UserCog,          roles: ['a'] },
      { to: '/driver-master',          label: 'Driver Master',          icon: IdCard,           roles: ['a'] },
      { to: '/employee-master',        label: 'Employee Master',        icon: BriefcaseBusiness,roles: ['a'] },
      { to: '/loading-source-master',  label: 'Loading Source Master',  icon: Fuel,             roles: ['a'] },
    ]
  }
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const role = roleOf(user);

  const [collapsed, setCollapsed] = useState(false);

  // Filter by role once
  const groups = useMemo(() => {
    return NAV_GROUPS.map(g => ({
      heading: g.heading,
      items: g.items.filter(i => i.roles.includes(role))
    })).filter(g => g.items.length > 0);
  }, [role]);

  return (
    <aside
      className={[
        'h-screen sticky top-0',
        'bg-gradient-to-b from-slate-900 to-slate-800 text-white',
        'flex flex-col border-r border-white/10',
        collapsed ? 'w-20' : 'w-64',
        'transition-[width] duration-200'
      ].join(' ')}
    >
      {/* Brand / Collapse */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
            {/* tiny logo-ish box */}
            <Fuel size={18} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-extrabold tracking-wide">FuelWale</div>
              <div className="text-xs text-white/70 -mt-0.5">Admin Console</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-white/10"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {groups.map(({ heading, items }) => (
          <div key={heading} className="px-2">
            {/* Group heading */}
            {!collapsed && (
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
                {heading}
              </div>
            )}

            <ul className="space-y-1">
              {items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      [
                        'group flex items-center gap-3 rounded-lg px-3 py-2',
                        'transition-colors',
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/10'
                      ].join(' ')
                    }
                    title={collapsed ? label : undefined}
                  >
                    <div className="shrink-0 rounded-md bg-white/10 p-1.5 group-hover:bg-white/20">
                      <Icon size={18} />
                    </div>
                    {!collapsed && (
                      <span className="truncate">{label}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            {/* subtle divider */}
            <div className="my-3 border-t border-white/10" />
          </div>
        ))}
      </nav>

      {/* User panel + Logout */}
      <div className="p-3 mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
          <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
            <Users size={16} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {user?.name || user?.username || 'User'}
              </div>
              <div className="text-xs text-white/70">
                {role === 'a' ? 'Admin' : role === 'e' ? 'Executive' : 'Driver'}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className={[
            'mt-3 w-full inline-flex items-center justify-center gap-2',
            'rounded-lg px-3 py-2 bg-rose-500/90 hover:bg-rose-500',
            'text-white transition-colors'
          ].join(' ')}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
