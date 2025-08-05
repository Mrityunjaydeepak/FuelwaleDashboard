import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  TruckIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon
} from 'lucide-react';

export default function DriverManagement() {
  const initialForm = {
    driverName:      '',
    profile:         '',
    depot:           '',
    pesoLicenseNo:   '',
    licenseNumber:   ''
  };

  const [form, setForm]             = useState(initialForm);
  const [employees, setEmployees]   = useState([]);
  const [depots, setDepots]         = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  // load lookups & drivers
  useEffect(() => {
    api.get('/employees').then(r => setEmployees(r.data));
    api.get('/depots').then(r => setDepots(r.data));
    api.get('/drivers').then(r => setDrivers(r.data));
  }, []);

  // filter by name
  const filtered = drivers.filter(d =>
    d.driverName.toLowerCase().includes(search.toLowerCase())
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
      await api.post('/drivers', form);
      const res = await api.get('/drivers');
      setDrivers(res.data);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create driver');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this driver?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      setDrivers(ds => ds.filter(d => d._id !== id));
    } catch {
      alert('Failed to delete driver');
    }
  };

  const startEdit = d => {
    setEditingId(d._id);
    setEditForm({
      driverName:      d.driverName,
      profile:         d.profile?._id      || '',
      depot:           d.depot?._id        || '',
      pesoLicenseNo:   d.pesoLicenseNo     || '',
      licenseNumber:   d.licenseNumber     || ''
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
      const res = await api.put(`/drivers/${editingId}`, editForm);
      setDrivers(ds => ds.map(d => d._id === editingId ? res.data : d));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update driver');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Create / Edit Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <TruckIcon size={24}/> Driver Management
        </h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form
          onSubmit={editingId ? submitEdit : handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <input
            name="driverName"
            placeholder="Driver Name"
            value={editingId ? editForm.driverName : form.driverName}
            onChange={editingId ? handleEditChange : handleChange}
            required
            className="border rounded px-3 py-2"
          />

          <select
            name="profile"
            value={editingId ? editForm.profile : form.profile}
            onChange={editingId ? handleEditChange : handleChange}
            className="border rounded px-3 py-2"
          >
            <option value="">Assign Employee Profile</option>
            {employees.map(e => (
              <option key={e._id} value={e._id}>
                {e.empCd} — {e.empName || e.name}
              </option>
            ))}
          </select>

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
            name="pesoLicenseNo"
            placeholder="PESO License No"
            value={editingId ? editForm.pesoLicenseNo : form.pesoLicenseNo}
            onChange={editingId ? handleEditChange : handleChange}
            className="border rounded px-3 py-2"
          />

          <input
            name="licenseNumber"
            placeholder="Driver License No"
            value={editingId ? editForm.licenseNumber : form.licenseNumber}
            onChange={editingId ? handleEditChange : handleChange}
            className="border rounded px-3 py-2"
          />

          <div className="md:col-span-2 lg:col-span-5 flex justify-end gap-2 mt-2">
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
        <h3 className="text-xl font-medium">Existing Drivers</h3>
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-1/3"
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow overflow-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {['#','Name','Employee','Depot','PESO Lic','Driver Lic','Created','Actions'].map((h,i) => (
                <th key={i} className="px-2 py-2 text-left text-sm font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr
                key={d._id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
              >
                {editingId === d._id ? (
                  <td colSpan="8" className="px-2 py-4 text-center text-sm">
                    Editing…
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-sm">{i + 1}</td>
                    <td className="px-2 py-2 text-sm">{d.driverName}</td>
                    <td className="px-2 py-2 text-sm">{d.profile?.empCd || '–'}</td>
                    <td className="px-2 py-2 text-sm">{d.depot?.depotCd || '–'}</td>
                    <td className="px-2 py-2 text-sm">{d.pesoLicenseNo || '–'}</td>
                    <td className="px-2 py-2 text-sm">{d.licenseNumber || '–'}</td>
                    <td className="px-2 py-2 text-sm">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2 flex gap-2">
                      <button onClick={() => startEdit(d)} title="Edit">
                        <Edit2Icon size={16}/>
                      </button>
                      <button onClick={() => handleDelete(d._id)} title="Delete">
                        <Trash2Icon size={16}/>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="8" className="px-2 py-4 text-center text-sm text-gray-500">
                  No drivers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
