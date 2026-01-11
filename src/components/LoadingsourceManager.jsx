// src/components/ProductMaster.jsx - WITH BACK & HOME BUTTONS
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Edit3, Plus, Search, Trash2, X, Home, ArrowLeft } from 'lucide-react';

const BASE = '/products';

const emptyForm = {
  name: '',
};

export default function ProductMaster() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [filtered, setFiltered] = useState([]);
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
  }, []);

  function sortSmart(a, b) {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    return an.localeCompare(bn);
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(BASE);
      const normalized = (res.data || []).map((o) => ({
        _id: o._id,
        name: o.name ?? '',
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
          ? 'Access denied. You do not have permission to view products.'
          : 'Failed to fetch products. Please try again.'
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
        [o.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    setFiltered(tmp.sort(sortSmart));
  }, [search, list]);

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
        name: o.name ?? ''
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

  const canSave = useMemo(() => {
    return form.name.trim().length > 0;
  }, [form.name]);

  const onSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim()
      };
      
      if (editingId) {
        await api.put(`${BASE}/${editingId}`, payload);
      } else {
        await api.post(BASE, payload);
      }

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
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`${BASE}/${id}`);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to delete record.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold">
              Product Master
            </div>
            <h1 className="text-xl font-bold tracking-wide text-gray-900">
              Products Management
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 shadow-sm"
              title="Home"
            >
              <Home size={14} />
              Home
            </button>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 shadow-sm"
              title="Back"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700"
            >
              <Plus size={14} />
              New Product
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
              <Search size={16} className="text-gray-500 mr-2" />
              <input
                placeholder="Search by product name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm w-80"
              />
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="text-sm font-semibold text-gray-900">
              All Products ({filtered.length})
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-gray-500" colSpan={4}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Loading products...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-gray-500" colSpan={4}>
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {o.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {o.updatedAt ? new Date(o.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEdit(o._id)} 
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all" 
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => onDelete(o._id)} 
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all" 
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {isOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : closeModal} />
            <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Edit Product' : 'New Product'}
                </h3>
                <button 
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all" 
                  onClick={closeModal} 
                  disabled={saving}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <TextField 
                    label="Product Name" 
                    value={form.name} 
                    onChange={(v) => onChange('name', v)} 
                    required 
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={closeModal} 
                    disabled={saving} 
                    className="flex-1 px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={onSave} 
                    disabled={!canSave || saving} 
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      editingId ? 'Save Changes' : 'Create Product'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}
