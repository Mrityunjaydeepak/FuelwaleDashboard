import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  RouteIcon,
  PlusIcon,
  Edit2Icon,
  SaveIcon,
  XIcon,
  Trash2Icon,
  SearchIcon
} from 'lucide-react';

export default function CreateRoute() {
  const initial = { depot: '', name: '' };

  const [form, setForm]           = useState(initial);
  const [depots, setDepots]       = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [info, setInfo]           = useState('');
  const [search, setSearch]       = useState('');

  // inline editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState(initial);
  const [savingId, setSavingId]   = useState(null);

  // ───────────────── helpers
  const normName  = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const isSameId  = (a, b) => String(a || '') === String(b || '');

  const loadAll = async () => {
    const [d1, d2] = await Promise.all([api.get('/depots'), api.get('/routes')]);
    setDepots(d1.data || []);
    setRoutes(d2.data || []);
  };

  useEffect(() => {
    loadAll().catch(() => setError('Failed to load depots/routes'));
  }, []);

  const depotLabel = (route) => {
    const dep = typeof route.depot === 'object' && route.depot
      ? route.depot
      : depots.find(d => isSameId(d._id, route.depot));
    return dep ? `${dep.depotCd} — ${dep.depotName}` : '—';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
    setInfo('');
  };

  const existsInDepot = (depotId, name, excludeId = null) =>
    routes.some(r =>
      isSameId(r.depot?._id || r.depot, depotId) &&
      normName(r.name) === normName(name) &&
      !isSameId(r._id, excludeId)
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (!form.depot || !form.name) {
        setError('Depot and Route Name are required.');
        setLoading(false);
        return;
      }
      if (existsInDepot(form.depot, form.name)) {
        const dup = routes.find(r => isSameId(r.depot?._id || r.depot, form.depot) && normName(r.name) === normName(form.name));
        const ok = window.confirm('This route already exists for the selected depot. Do you want to update it instead?');
        if (!ok) {
          setLoading(false);
          return;
        }
        await api.put(`/routes/${dup._id}`, { depot: form.depot, name: form.name });
        setInfo('Route updated.');
      } else {
        await api.post('/routes', { depot: form.depot, name: form.name });
        setInfo('Route created.');
      }
      const r = await api.get('/routes');
      setRoutes(r.data || []);
      setForm(initial);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save route');
    } finally {
      setLoading(false);
    }
  };

  // Edit handlers
  const startEdit = (r) => {
    setEditingId(r._id);
    setEditForm({
      depot: r.depot?._id || r.depot || '',
      name:  r.name || ''
    });
    setError('');
    setInfo('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initial);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(f => ({ ...f, [name]: value }));
  };

  const submitEdit = async (e) => {
    e?.preventDefault();
    if (!editingId) return;
    setSavingId(editingId);
    setError('');
    setInfo('');
    try {
      if (!editForm.depot || !editForm.name) {
        setError('Depot and Route Name are required.');
        setSavingId(null);
        return;
      }
      if (existsInDepot(editForm.depot, editForm.name, editingId)) {
        setError('Another route with the same name exists in this depot.');
        setSavingId(null);
        return;
      }
      const res = await api.put(`/routes/${editingId}`, { depot: editForm.depot, name: editForm.name });
      setRoutes(list => list.map(r => (r._id === editingId ? res.data : r)));
      setInfo('Route saved.');
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update route');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    setError('');
    setInfo('');
    try {
      await api.delete(`/routes/${id}`);
      setRoutes(list => list.filter(r => r._id !== id));
      if (editingId === id) cancelEdit();
      setInfo('Route deleted.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete route');
    }
  };

  // Filtered list
  const filtered = routes.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const dep = typeof r.depot === 'object' && r.depot
      ? r.depot
      : depots.find(d => isSameId(d._id, r.depot));
    const depStr = dep ? `${dep.depotCd} ${dep.depotName}`.toLowerCase() : '';
    return String(r.name || '').toLowerCase().includes(q) || depStr.includes(q);
  });

  return (
    <div className="p-4 lg:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Create / Upsert form (scrollable card) */}
        <div className="bg-white rounded-lg shadow flex flex-col max-h-[85vh]">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <RouteIcon size={22}/>
            <h2 className="text-xl font-semibold">Route Management</h2>
          </div>

          {(error || info) && (
            <div className="px-5 pt-3">
              {error && <div className="text-red-600 mb-2">{error}</div>}
              {info  && <div className="text-green-600 mb-2">{info}</div>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="block mb-1 font-semibold">Depot</label>
              <select
                name="depot"
                value={form.depot}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select Depot</option>
                {depots.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.depotCd} — {d.depotName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold">Route Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Downtown Loop"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </form>

          <div className="px-5 py-3 border-t bg-white">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {loading ? 'Saving…' : <span className="inline-flex items-center gap-2"><PlusIcon size={16}/> Save Route</span>}
            </button>
          </div>
        </div>

        {/* Right: Search + Table (own scroll) */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col max-h-[85vh]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b">
            <h3 className="text-lg font-semibold">Existing Routes</h3>
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by route or depot…"
                className="w-full border rounded pl-9 pr-3 py-2"
              />
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            </div>
          </div>

          <div className="overflow-auto mt-3">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Depot','Route Name','Created','Actions'].map((h,i)=>(
                    <th key={i} className="px-3 py-2 text-left text-xs sm:text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r._id} className="align-top hover:bg-gray-50">
                    {editingId === r._id ? (
                      <>
                        <td className="px-3 py-2">
                          <select
                            name="depot"
                            value={editForm.depot}
                            onChange={handleEditChange}
                            className="w-52 border rounded px-2 py-1"
                          >
                            <option value="">Select Depot</option>
                            {depots.map(d => (
                              <option key={d._id} value={d._id}>
                                {d.depotCd} — {d.depotName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                            className="w-full border rounded px-2 py-1"
                            placeholder="Route Name"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={submitEdit}
                              disabled={savingId === r._id}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1"
                              title="Save"
                            >
                              {savingId === r._id ? 'Saving…' : <><SaveIcon size={14}/> Save</>}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingId === r._id}
                              className="px-2 py-1 bg-gray-200 rounded inline-flex items-center gap-1"
                              title="Cancel"
                            >
                              <XIcon size={14}/> Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-sm">{depotLabel(r)}</td>
                        <td className="px-3 py-2 text-sm">{r.name}</td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(r)}
                              className="px-2 py-1 bg-white border rounded hover:bg-gray-100 inline-flex items-center gap-1"
                              title="Edit"
                            >
                              <Edit2Icon size={14}/> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(r._id)}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 inline-flex items-center gap-1"
                              title="Delete"
                            >
                              <Trash2Icon size={14}/> Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                      No routes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
