// src/components/loadingsourcemaster.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';

const BASE = '/loadingsources'; // <-- adjust if your router mounts at a different path

// Reasonable default shape if your model doesn't enforce schema strictly.
// Feel free to add/remove fields to match your backend model.
const emptyForm = {
  sourceCode: '',
  sourceName: '',
  address: '',
  city: '',
  state: '',
  contactName: '',
  contactPhone: '',
  isActive: true
};

export default function LoadingSourceMaster() {
  const [list, setList] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal + form state
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  function sortSmart(a, b) {
    // Active first, then by name/code
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    const an = (a.sourceName || '').toLowerCase();
    const bn = (b.sourceName || '').toLowerCase();
    if (an && bn && an !== bn) return an.localeCompare(bn);
    const ac = (a.sourceCode || '').toLowerCase();
    const bc = (b.sourceCode || '').toLowerCase();
    return ac.localeCompare(bc);
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(BASE); // GET all
      const normalized = (res.data || []).map((o) => ({
        _id: o._id,
        sourceCode: o.sourceCode ?? '',
        sourceName: o.sourceName ?? '',
        address: o.address ?? '',
        city: o.city ?? '',
        state: o.state ?? '',
        contactName: o.contactName ?? '',
        contactPhone: o.contactPhone ?? '',
        isActive: typeof o.isActive === 'boolean' ? o.isActive : true,
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

  // Derived filter
  useEffect(() => {
    let tmp = [...list];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      tmp = tmp.filter((o) =>
        [o.sourceCode, o.sourceName, o.city, o.state, o.contactName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (status !== 'ALL') {
      const want = status === 'ACTIVE';
      tmp = tmp.filter((o) => !!o.isActive === want);
    }
    setFiltered(tmp.sort(sortSmart));
  }, [search, status, list]);

  // Open create modal
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  // Open edit modal (fetch full document to be safe)
  const openEdit = async (id) => {
    try {
      const res = await api.get(`${BASE}/${id}`);
      const o = res.data || {};
      setEditingId(id);
      setForm({
        sourceCode: o.sourceCode ?? '',
        sourceName: o.sourceName ?? '',
        address: o.address ?? '',
        city: o.city ?? '',
        state: o.state ?? '',
        contactName: o.contactName ?? '',
        contactPhone: o.contactPhone ?? '',
        isActive: typeof o.isActive === 'boolean' ? o.isActive : true
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

  const onChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const canSave = useMemo(() => {
    // light validation
    return form.sourceName.trim().length > 0 && form.sourceCode.trim().length > 0;
  }, [form.sourceName, form.sourceCode]);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`${BASE}/${editingId}`, payload);
      } else {
        await api.post(BASE, payload);
      }
      closeModal();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to save. Please check your input and try again.');
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-4">Loading Source Master</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {/* Top Bar: Search + Filters + Create */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center border bg-white rounded px-2">
          <Search size={16} />
          <input
            placeholder="Search by code, name, city, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
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
              <th className="px-4 py-2 text-left">Source Name</th>
              <th className="px-4 py-2 text-left">City / State</th>
              <th className="px-4 py-2 text-left">Contact</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  No records found.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="border-t px-4 py-2">{o.sourceCode}</td>
                  <td className="border-t px-4 py-2">{o.sourceName}</td>
                  <td className="border-t px-4 py-2">
                    {[o.city, o.state].filter(Boolean).join(', ')}
                  </td>
                  <td className="border-t px-4 py-2">{o.contactName}</td>
                  <td className="border-t px-4 py-2">{o.contactPhone}</td>
                  <td className="border-t px-4 py-2 text-center">
                    {o.isActive ? (
                      <span className="inline-block text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="border-t px-4 py-2 text-center space-x-2">
                    <button
                      onClick={() => openEdit(o._id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(o._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={saving ? undefined : closeModal}
          />
          {/* Card */}
          <div className="relative z-10 w-[95%] md:w-[720px] bg-white rounded shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">
                {editingId ? 'Edit Loading Source' : 'New Loading Source'}
              </h3>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={closeModal}
                disabled={saving}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Source Code"
                value={form.sourceCode}
                onChange={(v) => onChange('sourceCode', v)}
                required
              />
              <TextField
                label="Source Name"
                value={form.sourceName}
                onChange={(v) => onChange('sourceName', v)}
                required
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(v) => onChange('city', v)}
              />
              <TextField
                label="State"
                value={form.state}
                onChange={(v) => onChange('state', v)}
              />
              <TextField
                label="Address"
                value={form.address}
                onChange={(v) => onChange('address', v)}
                colSpan
              />
              <TextField
                label="Contact Name"
                value={form.contactName}
                onChange={(v) => onChange('contactName', v)}
              />
              <TextField
                label="Contact Phone"
                value={form.contactPhone}
                onChange={(v) => onChange('contactPhone', v)}
              />
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={!!form.isActive}
                  onChange={(e) => onChange('isActive', e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canSave || saving}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- small field component -------------------- */
function TextField({ label, value, onChange, required = false, colSpan = false }) {
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
      />
    </div>
  );
}
