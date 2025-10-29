import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  UserIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon,
  RotateCcwIcon
} from 'lucide-react';

// User type labels incl. new VA/TR/AC
const USER_TYPE_OPTIONS = [
  { value: 'E',  label: 'Employee' },
  { value: 'D',  label: 'Driver' },
  { value: 'C',  label: 'Customer' },
  { value: 'A',  label: 'Admin' },
  { value: 'VA', label: 'Vehicle Allocation' },
  { value: 'TR', label: 'Trips' },
  { value: 'AC', label: 'Accounts' }
];
const typeLabel = USER_TYPE_OPTIONS.reduce((m, o) => (m[o.value] = o.label, m), {});

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

  const [adminBlocked, setAdminBlocked] = useState(false);

  // View mode for soft-deletes
  // 'active' => default (backend auto-excludes deleted)
  // 'all'    => include deleted (?withDeleted=1)
  // 'deleted'=> only deleted (?onlyDeleted=1)
  const [viewMode, setViewMode] = useState('active');
  const viewQueryParams = useMemo(() => {
    if (viewMode === 'all') return { withDeleted: 1 };
    if (viewMode === 'deleted') return { onlyDeleted: 1 };
    return {}; // active
  }, [viewMode]);

  const loadLookups = async () => {
    const [d1, d2, d3, d4] = await Promise.all([
      api.get('/depots'),
      api.get('/employees'),
      api.get('/drivers'),
      api.get('/customers')
    ]);
    setDepots(d1.data || []);
    setEmployees(d2.data || []);
    setDrivers(d3.data || []);
    setCustomers(d4.data || []);
  };

  const loadUsers = async () => {
    const res = await api.get('/users', { params: viewQueryParams });
    setUsers(res.data || []);
  };

  // Load lookups on mount
  useEffect(() => {
    (async () => {
      try {
        await loadLookups();
      } catch (e) {
        setError('Failed to load lookups');
      }
    })();
  }, []);

  // Load users whenever view mode changes
  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
        setAdminBlocked(false);
      } catch (e) {
        if (e?.response?.status === 403) {
          setAdminBlocked(true);
        } else {
          setError('Failed to load users');
        }
      }
    })();
  }, [viewMode]); // eslint-disable-line 

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
        // clear mapping fields when switching type (only E/D/C use mappings)
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
      await loadUsers();
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  // Soft delete user
  const handleDelete = async id => {
    if (!window.confirm('Soft delete this user? They can be restored later.')) return;
    const reason = window.prompt('Optional: reason for deletion (leave blank to skip)') || undefined;
    try {
      await api.delete(`/users/${id}`, { data: { reason } });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // Restore user
  const handleRestore = async id => {
    try {
      await api.post(`/users/${id}/restore`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restore user');
    }
  };

  // Start inline editing (disabled for deleted users)
  const startEdit = u => {
    if (u.deleted) {
      setError('Cannot edit a deleted user. Restore the user first.');
      return;
    }
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
        // clear mapping fields when switching type (only E/D/C use mappings)
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
      const res = await api.put(`/users/${editingId}`, body, {
        params: viewQueryParams.withDeleted ? { withDeleted: 1 } : undefined
      });
      // Replace row with updated data
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

  const StatusBadge = ({ u }) => {
    if (u.deleted) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
          Deleted
          {u.deletedAt && (
            <span className="opacity-70">
              ({new Date(u.deletedAt).toLocaleDateString()})
            </span>
          )}
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
        Active
      </span>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* — Create / Add User Form — */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <UserIcon size={24}/> Credential Management
        </h2>

        {adminBlocked && (
          <div className="mb-4 p-3 border border-yellow-300 bg-yellow-50 rounded text-yellow-800">
            You need <b>Admin (userType A)</b> to create or view users.
          </div>
        )}

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            name="userId"
            placeholder="User ID"
            value={form.userId}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          />

          <select
            name="userType"
            value={form.userType}
            onChange={handleChange}
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          >
            {USER_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <input
            name="pwd"
            type="password"
            placeholder="Password"
            value={form.pwd}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          />

          <input
            name="mobileNo"
            placeholder="Mobile No"
            value={form.mobileNo}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          />

          <select
            name="depotCd"
            value={form.depotCd}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          >
            <option value="">Depot</option>
            {depots.map(d => (
              <option key={d._id} value={d.depotCd}>
                {d.depotCd} — {d.depotName}
              </option>
            ))}
          </select>

          {/* Conditional mapping fields (only for E/D/C) */}
          {form.userType === 'E' && (
            <select
              name="empCd"
              value={form.empCd}
              onChange={handleChange}
              required
              className="border rounded px-3 py-2"
              disabled={adminBlocked}
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
              disabled={adminBlocked}
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
              disabled={adminBlocked}
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
              disabled={loading || adminBlocked}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading
                ? 'Adding…'
                : <><PlusIcon className="inline mr-1"/> Add</>}
            </button>
          </div>
        </form>
      </div>

      {/* — Toolbar: View mode + Search — */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">View:</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="border rounded px-3 py-2"
            disabled={adminBlocked}
          >
            <option value="active">Active</option>
            <option value="all">All (include deleted)</option>
            <option value="deleted">Deleted only</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Search by ID or mobile…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/3"
          disabled={adminBlocked}
        />
      </div>

      {/* — User List — */}
      <div className="bg-white p-4 rounded-lg shadow overflow-auto max-h-[560px]">
        {adminBlocked ? (
          <div className="text-center text-gray-500 py-8">
            Admin-only area.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                {['#','Status','User ID','Type','Mobile','Depot','Mapping','Created','Actions'].map((h,i) => (
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
                  className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 ${u.deleted ? 'opacity-75' : ''}`}
                >
                  {editingId === u._id ? (
                    <td colSpan={9} className="px-3 py-3">
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
                          {USER_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
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

                        {/* mapping field depends on userType (only E/D/C) */}
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
                      <td className="px-2 py-2 text-sm"><StatusBadge u={u} /></td>
                      <td className="px-2 py-2 text-sm">
                        {u.deleted ? <span className="line-through">{u.userId}</span> : u.userId}
                      </td>
                      <td className="px-2 py-2 text-sm">{typeLabel[u.userType] || u.userType}</td>
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
                      <td className="px-2 py-2 flex gap-2 items-center">
                        {!u.deleted && (
                          <button onClick={() => startEdit(u)} title="Edit" className="p-1 hover:text-blue-600">
                            <Edit2Icon size={16}/>
                          </button>
                        )}
                        {!u.deleted ? (
                          <button onClick={() => handleDelete(u._id)} title="Soft delete" className="p-1 hover:text-red-600">
                            <Trash2Icon size={16}/>
                          </button>
                        ) : (
                          <button onClick={() => handleRestore(u._id)} title="Restore user" className="p-1 hover:text-green-700">
                            <RotateCcwIcon size={16}/>
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
