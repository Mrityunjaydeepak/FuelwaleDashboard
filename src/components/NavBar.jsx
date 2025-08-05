// src/components/NavBar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  UserPlus,
  Building2,
  RouteIcon,
  TruckIcon,
  LogOut
} from 'lucide-react';

const navItems = [
  { to: '/',             label: 'Dashboard',    icon: <HomeIcon size={20}/>,    roles: ['a','s'] },
  { to: '/create-user',  label: 'Create User',  icon: <UserPlus size={20}/>,    roles: ['a']    },
  { to: '/create-depot', label: 'Create Depot', icon: <Building2 size={20}/>,   roles: ['a']    },
  { to: '/create-route', label: 'Create Route', icon: <RouteIcon size={20}/>,    roles: ['a']    },
  { to: '/create-order', label: 'Create Order', icon: <TruckIcon size={20}/>,    roles: ['a','s'] },
  { to: '/list-order',   label: 'List Orders',  icon: <RouteIcon size={20}/>,    roles: ['a','s'] },
  { to: '/trip-manager',   label: 'Trip Manager',  icon: <RouteIcon size={20}/>,    roles: ['a','s'] },
  { to: '/driver-trips',   label: 'Driver Trips',  icon: <RouteIcon size={20}/>,    roles: ['a','d'] },
  { to: '/driver-deliveries',   label: 'Driver Deliveries',  icon: <RouteIcon size={20}/>,    roles: ['a','d'] },
  { to: '/vehicle-master',   label: 'Vehicle Master',  icon: <RouteIcon size={20}/>,    roles: ['a'] },
  { to: '/customer-master',   label: 'Customer Master',  icon: <RouteIcon size={20}/>,    roles: ['a'] },
  { to: '/user-master',   label: 'User Master',  icon: <RouteIcon size={20}/>,    roles: ['a'] },
  { to: '/driver-master',   label: 'Driver Master',  icon: <RouteIcon size={20}/>,    roles: ['a'] },
  { to: '/employee-master',   label: 'Employee Master',  icon: <RouteIcon size={20}/>,    roles: ['a'] },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const userType = user?.userType?.toLowerCase();  // 'a' or 's'

  return (
    <aside className="w-64 bg-white shadow-lg min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-blue-600">
          FuelWale Admin
        </h1>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(({ to, label, icon, roles }) => (
          // only render if this role is allowed
          roles.includes(userType) ? (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {icon}
              <span>{label}</span>
            </NavLink>
          ) : null
        ))}
      </nav>

      <button
        onClick={logout}
        className="mt-auto mx-4 mb-6 flex items-center gap-2 text-red-600 hover:text-red-800"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
