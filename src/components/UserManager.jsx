import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  UserIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon
} from 'lucide-react';

export default function UserManagement() {
  const initialForm = {
    userId:      '',
    userType:    'E',
    pwd:         '',
    mobileNo:    '',
    depotCd:     '',
    empCd:       '',
    driverId:    '',
    customerId:  ''
  };

  const [form, setForm]             = useState(initialForm);
  const [depots, setDepots]         = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  // Load lookups & existing users
  useEffect(() => {
    (async () => {
      try {
        const [d1, d2, d3, d4, d5] = await Promise.all([
          api.get('/depots'),
          api.get('/employees'),
          api.get('/drivers'),
          api.get('/customers'),
          api.get('/users')
        ]);
        setDepots(d1.data || []);
        setEmployees(d2.data || []);
        setDrivers(d3.data || []);
        setCustomers(d4.data || []);
        setUsers(d5.data || []);
      } catch (e) {
        setError('Failed to load data');
      }
    })();
  }, []);

  // Filter users by ID or mobile (safe against missing fields)
  const filtered = users.filter(u =>
    String(u.userId || '').toLowerCase().includes(search.toLowerCase()) ||
    String(u.mobileNo || '').includes(search)
  );

  // Handle create form changes
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => {
      if (name === 'userType') {
        // clear incompatible mapping fields when type changes
        return { ...f, userType: value, empCd: '', driverId: '', customerId: '' };
      }
      return { ...f, [name]: value };
    });
    setError('');
  };

  // Submit create
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users', form);
      const res = await api.get('/users');
      setUsers(res.data);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDelete = async id => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(us => us.filter(u => u._id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // Start inline editing
  const startEdit = u => {
    setEditingId(u._id);
    setEditForm({
      userId:     u.userId,
      userType:   u.userType,
      pwd:        '',               // blank = no change
      mobileNo:   u.mobileNo || '',
      depotCd:    u.depotCd || '',
      empCd:      u.employee?.empCd || '',
      driverId:   u.driver?._id     || '',
      customerId: u.customer?._id   || ''
    });
    setError('');
  };

  // Handle edit form changes
  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditForm(f => {
      if (name === 'userType') {
        // when switching type, clear other mapping fields
        return { ...f, userType: value, empCd: '', driverId: '', customerId: '' };
      }
      return { ...f, [name]: value };
    });
    setError('');
  };

  // Submit inline edit
  const submitEdit = async e => {
    e?.preventDefault();
    setEditLoading(true);
    try {
      const body = { ...editForm };
      if (!body.pwd) delete body.pwd;  // don't send empty pwd
      const res = await api.put(`/users/${editingId}`, body);
      setUsers(us => us.map(u => (u._id === editingId ? res.data : u)));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* — Create / Add User Form — */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <UserIcon size={24}/> User Management
        </h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            name="userId"
            placeholder="User ID"
            value={form.userId}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <select
            name="userType"
            value={form.userType}
            onChange={handleChange}
            className="border rounded px-3 py-2"
          >
            <option value="E">Employee</option>
            <option value="D">Driver</option>
            <option value="C">Customer</option>
            <option value="A">Admin</option>
          </select>

          <input
            name="pwd"
            type="password"
            placeholder="Password"
            value={form.pwd}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <input
            name="mobileNo"
            placeholder="Mobile No"
            value={form.mobileNo}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <select
            name="depotCd"
            value={form.depotCd}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
          >
            <option value="">Depot</option>
            {depots.map(d => (
              <option key={d._id} value={d.depotCd}>
                {d.depotCd} — {d.depotName}
              </option>
            ))}
          </select>

          {/* Conditional mapping fields */}
          {form.userType === 'E' && (
            <select
              name="empCd"
              value={form.empCd}
              onChange={handleChange}
              required
              className="border rounded px-3 py-2"
            >
              <option value="">Employee</option>
              {employees.map(e => (
                <option key={e._id} value={e.empCd}>
                  {e.empCd} — {e.empName}
                </option>
              ))}
            </select>
          )}

          {form.userType === 'D' && (
            <select
              name="driverId"
              value={form.driverId}
              onChange={handleChange}
              required
              className="border rounded px-3 py-2"
            >
              <option value="">Driver</option>
              {drivers.map(d => (
                <option key={d._id} value={d._id}>
                  {d._id}
                </option>
              ))}
            </select>
          )}

          {form.userType === 'C' && (
            <select
              name="customerId"
              value={form.customerId}
              onChange={handleChange}
              required
              className="border rounded px-3 py-2"
            >
              <option value="">Customer</option>
              {customers.map(c => (
                <option key={c._id} value={c._id}>
                  {c.custCd} — {c.custName}
                </option>
              ))}
            </select>
          )}

          <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              {loading
                ? 'Adding…'
                : <><PlusIcon className="inline mr-1"/> Add</>}
            </button>
          </div>
        </form>
      </div>

      {/* — Search & User List — */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Users</h3>
        <input
          type="text"
          placeholder="Search by ID or mobile…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/3"
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow overflow-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              {['#','User ID','Type','Mobile','Depot','Mapping','Created','Actions'].map((h,i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-left text-sm font-semibold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr
                key={u._id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
              >
                {editingId === u._id ? (
                  <td colSpan={8} className="px-3 py-3">
                    <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      <input
                        name="userId"
                        value={editForm.userId}
                        onChange={handleEditChange}
                        className="border rounded px-3 py-2"
                        placeholder="User ID"
                        disabled // typically immutable
                      />

                      <select
                        name="userType"
                        value={editForm.userType}
                        onChange={handleEditChange}
                        className="border rounded px-3 py-2"
                      >
                        <option value="E">Employee</option>
                        <option value="D">Driver</option>
                        <option value="C">Customer</option>
                        <option value="A">Admin</option>
                      </select>

                      <input
                        name="pwd"
                        type="password"
                        value={editForm.pwd}
                        onChange={handleEditChange}
                        className="border rounded px-3 py-2"
                        placeholder="New password (optional)"
                      />

                      <input
                        name="mobileNo"
                        value={editForm.mobileNo}
                        onChange={handleEditChange}
                        className="border rounded px-3 py-2"
                        placeholder="Mobile No"
                      />

                      <select
                        name="depotCd"
                        value={editForm.depotCd}
                        onChange={handleEditChange}
                        className="border rounded px-3 py-2"
                      >
                        <option value="">Depot</option>
                        {depots.map(d => (
                          <option key={d._id} value={d.depotCd}>
                            {d.depotCd} — {d.depotName}
                          </option>
                        ))}
                      </select>

                      {/* mapping field depends on userType */}
                      {editForm.userType === 'E' && (
                        <select
                          name="empCd"
                          value={editForm.empCd}
                          onChange={handleEditChange}
                          className="border rounded px-3 py-2"
                        >
                          <option value="">Employee</option>
                          {employees.map(e => (
                            <option key={e._id} value={e.empCd}>
                              {e.empCd} — {e.empName}
                            </option>
                          ))}
                        </select>
                      )}

                      {editForm.userType === 'D' && (
                        <select
                          name="driverId"
                          value={editForm.driverId}
                          onChange={handleEditChange}
                          className="border rounded px-3 py-2"
                        >
                          <option value="">Driver</option>
                          {drivers.map(d => (
                            <option key={d._id} value={d._id}>
                              {d._id}
                            </option>
                          ))}
                        </select>
                      )}

                      {editForm.userType === 'C' && (
                        <select
                          name="customerId"
                          value={editForm.customerId}
                          onChange={handleEditChange}
                          className="border rounded px-3 py-2"
                        >
                          <option value="">Customer</option>
                          {customers.map(c => (
                            <option key={c._id} value={c._id}>
                              {c.custCd} — {c.custName}
                            </option>
                          ))}
                        </select>
                      )}

                      <div className="md:col-span-3 lg:col-span-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={editLoading}
                          className="px-3 py-2 bg-gray-200 rounded flex items-center gap-1"
                        >
                          <XIcon size={16}/> Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editLoading}
                          className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-1"
                        >
                          {editLoading ? 'Saving…' : <><SaveIcon size={16}/> Save</>}
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-sm">{i + 1}</td>
                    <td className="px-2 py-2 text-sm">{u.userId}</td>
                    <td className="px-2 py-2 text-sm">{u.userType}</td>
                    <td className="px-2 py-2 text-sm">{u.mobileNo}</td>
                    <td className="px-2 py-2 text-sm">{u.depotCd}</td>
                    <td className="px-2 py-2 text-sm">
                      {u.userType === 'E' ? (u.employee?.empCd || '—')
                        : u.userType === 'D' ? (u.driver?._id || '—')
                        : u.userType === 'C' ? (u.customer?.custCd || '—')
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-2 py-2 flex gap-2">
                      <button onClick={() => startEdit(u)} title="Edit" className="p-1 hover:text-blue-600">
                        <Edit2Icon size={16}/>
                      </button>
                      <button onClick={() => handleDelete(u._id)} title="Delete" className="p-1 hover:text-red-600">
                        <Trash2Icon size={16}/>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
