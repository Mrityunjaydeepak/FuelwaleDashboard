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

export default function EmployeeManagement() {
  const initialForm = {
    empCd:       '',
    empName:     '',
    depot:       '',
    accessLevel: ''
  };

  const [form, setForm]             = useState(initialForm);
  const [depots, setDepots]         = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  // Load depots & employees
  useEffect(() => {
    api.get('/depots').then(r => setDepots(r.data));
    api.get('/employees').then(r => setEmployees(r.data));
  }, []);

  // Filter employees by code or name
  const filtered = employees.filter(e =>
    e.empCd.toLowerCase().includes(search.toLowerCase()) ||
    e.empName.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/employees', {
        empCd:       form.empCd,
        empName:     form.empName,
        depot:       form.depot,
        accessLevel: form.accessLevel
      });
      const res = await api.get('/employees');
      setEmployees(res.data);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      setEmployees(es => es.filter(e => e._id !== id));
    } catch {
      alert('Failed to delete employee');
    }
  };

  const startEdit = emp => {
    setEditingId(emp._id);
    setEditForm({
      empCd:       emp.empCd,
      empName:     emp.empName,
      depot:       emp.depotCd?._id || '',
      accessLevel: emp.accessLevel
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const submitEdit = async e => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.put(`/employees/${editingId}`, {
        empCd:       editForm.empCd,
        empName:     editForm.empName,
        depot:       editForm.depot,
        accessLevel: editForm.accessLevel
      });
      setEmployees(es => es.map(e => e._id === editingId ? res.data : e));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update employee');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Create / Edit Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <UserIcon size={24}/> Employee Management
        </h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form
          onSubmit={editingId ? submitEdit : handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <input
            name="empCd"
            placeholder="Employee Code"
            value={editingId ? editForm.empCd : form.empCd}
            onChange={editingId ? handleEditChange : handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <input
            name="empName"
            placeholder="Employee Name"
            value={editingId ? editForm.empName : form.empName}
            onChange={editingId ? handleEditChange : handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <select
            name="depot"
            value={editingId ? editForm.depot : form.depot}
            onChange={editingId ? handleEditChange : handleChange}
            required
            className="border rounded px-3 py-2"
          >
            <option value="">Select Depot</option>
            {depots.map(d => (
              <option key={d._id} value={d._id}>
                {d.depotCd} — {d.depotName}
              </option>
            ))}
          </select>

          <input
            name="accessLevel"
            placeholder="Access Level"
            value={editingId ? editForm.accessLevel : form.accessLevel}
            onChange={editingId ? handleEditChange : handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-2 mt-2">
            <button
              type="submit"
              disabled={loading || editLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              {editingId
                ? editLoading ? 'Saving…' : <><SaveIcon className="inline mr-1"/> Save</>
                : loading     ? 'Adding…' : <><PlusIcon className="inline mr-1"/> Add</>
              }
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={editLoading}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
              >
                <XIcon className="inline mr-1"/> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Search & Table */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Existing Employees</h3>
        <input
          type="text"
          placeholder="Search by code or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/3"
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow overflow-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {['#','Code','Name','Depot','Access','Created','Actions'].map((h,i) => (
                <th key={i} className="px-2 py-2 text-left text-sm font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={e._id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
              >
                {editingId === e._id ? (
                  <td colSpan="7" className="px-2 py-4 text-center text-sm">
                    Editing…
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-sm">{i + 1}</td>
                    <td className="px-2 py-2 text-sm">{e.empCd}</td>
                    <td className="px-2 py-2 text-sm">{e.empName}</td>
                    <td className="px-2 py-2 text-sm">{e.depotCd?.depotCd || '–'}</td>
                    <td className="px-2 py-2 text-sm">{e.accessLevel}</td>
                    <td className="px-2 py-2 text-sm">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2 flex gap-2">
                      <button onClick={() => startEdit(e)} title="Edit">
                        <Edit2Icon size={16}/>
                      </button>
                      <button onClick={() => handleDelete(e._id)} title="Delete">
                        <Trash2Icon size={16}/>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="7" className="px-2 py-4 text-center text-sm text-gray-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
