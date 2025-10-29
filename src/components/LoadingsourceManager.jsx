// src/components/loadingsourcemaster.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';

const BASE = '/loadingsources'; // /api base handled by api instance

const emptyForm = {
  loadSourceCd: '',
  name: '',
  add1: '',
  add2: '',
  add3: '',
  area: '',
  city: '',
  pin: '',
  stateCd: '',
  routeIds: [] // multiple selected route IDs
};

export default function LoadingSourceMaster() {
  const [list, setList] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [routes, setRoutes] = useState([]); // all routes [{_id, name}]
  const [routeMap, setRouteMap] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal + form state
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchRoutes();
  }, []);

  function sortSmart(a, b) {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    if (an && bn && an !== bn) return an.localeCompare(bn);
    const ac = (a.loadSourceCd || '').toLowerCase();
    const bc = (b.loadSourceCd || '').toLowerCase();
    return ac.localeCompare(bc);
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(BASE);
      const normalized = (res.data || []).map((o) => ({
        _id: o._id,
        loadSourceCd: o.loadSourceCd ?? '',
        name: o.name ?? '',
        add1: o.add1 ?? '',
        add2: o.add2 ?? '',
        add3: o.add3 ?? '',
        area: o.area ?? '',
        city: o.city ?? '',
        pin: o.pin ?? '',
        stateCd: o.stateCd ?? '',
        routeIds: Array.isArray(o.routeIds) ? o.routeIds.map(String) : [],
        createdAt: o.createdAt ?? null,
        updatedAt: o.updatedAt ?? null
      }));
      setList(normalized.sort(sortSmart));
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.status === 401
          ? 'Unauthorized. Please log in.'
          : e?.response?.status === 403
          ? 'Access denied. You do not have permission to view loading sources.'
          : 'Failed to fetch loading sources. Please try again.'
      );
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoutes() {
    try {
      const res = await api.get('/routes');
      const items = (res.data || []).map(r => ({ _id: String(r._id), name: r.name || '(unnamed route)' }));
      setRoutes(items);
      setRouteMap(Object.fromEntries(items.map(r => [r._id, r.name])));
    } catch (e) {
      console.error(e);
      // keep UI usable even if routes fail to load
    }
  }

  // Derived filter
  useEffect(() => {
    let tmp = [...list];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      tmp = tmp.filter((o) =>
        [
          o.loadSourceCd, o.name, o.city, o.stateCd, o.area, o.pin?.toString(),
          o.add1, o.add2, o.add3,
          ...(o.routeIds || []).map(id => routeMap[id]) // search by route name too
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    setFiltered(tmp.sort(sortSmart));
  }, [search, list, routeMap]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await api.get(`${BASE}/${id}`);
      const o = res.data || {};
      setEditingId(id);
      setForm({
        loadSourceCd: o.loadSourceCd ?? '',
        name: o.name ?? '',
        add1: o.add1 ?? '',
        add2: o.add2 ?? '',
        add3: o.add3 ?? '',
        area: o.area ?? '',
        city: o.city ?? '',
        pin: o.pin ?? '',
        stateCd: o.stateCd ?? '',
        routeIds: Array.isArray(o.routeIds) ? o.routeIds.map(String) : []
      });
      setIsOpen(true);
    } catch (e) {
      console.error(e);
      alert('Failed to load record for editing.');
    }
  };

  const closeModal = () => {
    if (saving) return;
    setIsOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const onChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const onChangeCode  = (v) => onChange('loadSourceCd', v.toUpperCase().slice(0, 3));
  const onChangeState = (v) => onChange('stateCd', v.toUpperCase().slice(0, 2));
  const onChangePin   = (v) => onChange('pin', v.replace(/\D/g, ''));

  // Multi-select routes change
  const onRoutesChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
    setForm(f => ({ ...f, routeIds: selected }));
  };

  const canSave = useMemo(() => {
    const codeOk  = form.loadSourceCd.trim().length > 0 && form.loadSourceCd.trim().length <= 3;
    const nameOk  = form.name.trim().length > 0;
    const stateOk = form.stateCd === '' || form.stateCd.length === 2;
    const pinOk   = form.pin === '' || /^\d+$/.test(String(form.pin));
    return codeOk && nameOk && stateOk && pinOk;
  }, [form.loadSourceCd, form.name, form.stateCd, form.pin]);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        loadSourceCd: form.loadSourceCd.trim().toUpperCase(),
        name: form.name.trim(),
        add1: form.add1?.trim() || '',
        add2: form.add2?.trim() || '',
        add3: form.add3?.trim() || '',
        area: form.area?.trim() || '',
        city: form.city?.trim() || '',
        stateCd: form.stateCd.trim().toUpperCase(),
        ...(form.pin !== '' ? { pin: Number(form.pin) } : {}),
        routeIds: form.routeIds // multiple IDs
      };
      if (editingId) await api.put(`${BASE}/${editingId}`, payload);
      else await api.post(BASE, payload);

      closeModal();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e?.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this loading source?')) return;
    try {
      await api.delete(`${BASE}/${id}`);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to delete record.');
    }
  };

  const addr = (o) => [o.add1, o.add2, o.add3].filter(Boolean).join(', ');
  const renderRoutes = (ids) => (ids || []).map(id => routeMap[id]).filter(Boolean).join(', ');

  // size for the multi-select (shows between 4 and 8 rows)
  const selectSize = Math.max(4, Math.min(8, routes.length || 0));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-4">Loading Source Master</h2>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center border bg-white rounded px-2">
          <Search size={16} />
          <input
            placeholder="Search by code, name, city, state, area, PIN, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>

        <div className="md:ml-auto">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          >
            <Plus size={16} /> New Loading Source
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Address</th>
              <th className="px-4 py-2 text-left">Area</th>
              <th className="px-4 py-2 text-left">City</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-left">PIN</th>
              <th className="px-4 py-2 text-left">Routes</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center" colSpan={9}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>No records found.</td></tr>
            ) : (
              filtered.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="border-t px-4 py-2">{o.loadSourceCd}</td>
                  <td className="border-t px-4 py-2">{o.name}</td>
                  <td className="border-t px-4 py-2">{addr(o)}</td>
                  <td className="border-t px-4 py-2">{o.area}</td>
                  <td className="border-t px-4 py-2">{o.city}</td>
                  <td className="border-t px-4 py-2">{o.stateCd}</td>
                  <td className="border-t px-4 py-2">{o.pin}</td>
                  <td className="border-t px-4 py-2">{renderRoutes(o.routeIds)}</td>
                  <td className="border-t px-4 py-2 text-center space-x-2">
                    <button onClick={() => openEdit(o._id)} className="text-blue-600 hover:text-blue-800" title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => onDelete(o._id)} className="text-red-600 hover:text-red-800" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : closeModal} />
          <div className="relative z-10 w-[95%] md:w-[900px] bg-white rounded shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Loading Source' : 'New Loading Source'}</h3>
              <button className="p-1 rounded hover:bg-gray-100" onClick={closeModal} disabled={saving} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Source Code (max 3)" value={form.loadSourceCd} onChange={onChangeCode} required />
              <TextField label="Name" value={form.name} onChange={(v) => onChange('name', v)} required colSpan />
              <TextField label="Address Line 1" value={form.add1} onChange={(v) => onChange('add1', v)} colSpan />
              <TextField label="Address Line 2" value={form.add2} onChange={(v) => onChange('add2', v)} colSpan />
              <TextField label="Address Line 3" value={form.add3} onChange={(v) => onChange('add3', v)} colSpan />
              <TextField label="Area" value={form.area} onChange={(v) => onChange('area', v)} />
              <TextField label="City" value={form.city} onChange={(v) => onChange('city', v)} />
              <TextField label="State Code (2)" value={form.stateCd} onChange={onChangeState} />
              <TextField label="PIN" value={form.pin} onChange={onChangePin} type="number" />

              {/* Routes multi-select */}
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-600 mb-1">Routes</label>
                <select
                  multiple
                  size={selectSize}
                  value={form.routeIds}
                  onChange={onRoutesChange}
                  className="w-full border rounded px-3 py-2 bg-gray-50"
                  disabled={routes.length === 0}
                >
                  {routes.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {routes.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">No routes found.</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => setForm(f => ({ ...f, routeIds: routes.map(r => r._id) }))}
                    disabled={routes.length === 0}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => setForm(f => ({ ...f, routeIds: [] }))}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button onClick={closeModal} disabled={saving} className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={onSave} disabled={!canSave || saving} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, required = false, colSpan = false, type = 'text' }) {
  return (
    <div className={colSpan ? 'md:col-span-2' : ''}>
      <label className="block text-sm text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        type={type}
      />
    </div>
  );
}
