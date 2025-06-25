import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UserForm from './components/UserForm';
import DepotForm from './components/DepotForm';
import EmployeeForm from './components/EmployeeForm';
import SalesAssociateForm from './components/SalesAssociateForm';
import CreateRoute from './components/CreateRoute';
import Orders from './components/Orders';
import OrdersList from './components/OrderList';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* all protected routes share the same layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="create-user" element={<UserForm />} />
              <Route path="create-route" element={<CreateRoute />} />
              <Route path="create-depot" element={<DepotForm />} />
              <Route path="create-employee" element={<EmployeeForm />} />
              <Route path="create-sales-associate" element={<SalesAssociateForm />} />
              <Route path="create-order" element={<Orders />} />
              <Route path="list-order" element={<OrdersList />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
