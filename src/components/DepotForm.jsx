import React, { useState, useEffect } from 'react';
import api from '../api';
import { PlusIcon, Edit2Icon, SaveIcon, XIcon, Trash2Icon, SearchIcon } from 'lucide-react';

export default function DepotManagement() {
  const initial = {
    depotCd: '',
    depotName: '',
    depotAdd1: '',
    depotAdd2: '',
    depotAdd3: '',
    depotArea: '',
    city: '',
    pin: '',
    stateCd: ''
  };

  const [form, setForm]         = useState(initial);
  const [depots, setDepots]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [search, setSearch]     = useState('');

  // inline edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState(initial);

  // ───────────────── helpers
  const normalizeCd = s => String(s || '').trim().toUpperCase();
  const toNumOrUndef = v => (v === '' || v == null ? undefined : parseInt(v, 10));

  const loadDepots = async () => {
    const res = await api.get('/depots');
    setDepots(res.data || []);
  };

  useEffect(() => {
    loadDepots().catch(() => setError('Failed to load depots'));
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({
      ...f,
      [name]: name === 'depotCd' || name === 'stateCd' ? value.toUpperCase() : value
    }));
    setError('');
    setInfo('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const payload = {
        ...form,
        depotCd: normalizeCd(form.depotCd),
        stateCd: normalizeCd(form.stateCd),
        pin:     toNumOrUndef(form.pin)
      };
      if (!payload.depotCd || !payload.depotName) {
        setError('Depot Code and Depot Name are required');
        setLoading(false);
        return;
      }

      // If depot with same code exists, offer to update instead of creating
      const existing = depots.find(
        d => normalizeCd(d.depotCd) === payload.depotCd
      );

      if (existing) {
        const ok = window.confirm(
          `Depot "${payload.depotCd}" already exists. Do you want to update it instead?`
        );
        if (!ok) {
          setLoading(false);
          return;
        }
        await api.put(`/depots/${existing._id}`, payload);
        setInfo(`Updated depot ${payload.depotCd}.`);
      } else {
        await api.post('/depots', payload);
        setInfo(`Created depot ${payload.depotCd}.`);
      }

      await loadDepots();
      setForm(initial);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = d => {
    setEditingId(d._id);
    setEditForm({
      depotCd:   d.depotCd || '',
      depotName: d.depotName || '',
      depotAdd1: d.depotAdd1 || '',
      depotAdd2: d.depotAdd2 || '',
      depotAdd3: d.depotAdd3 || '',
      depotArea: d.depotArea || '',
      city:      d.city || '',
      pin:       d.pin?.toString() || '',
      stateCd:   d.stateCd || ''
    });
    setError('');
    setInfo('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initial);
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditForm(f => ({
      ...f,
      [name]: name === 'depotCd' || name === 'stateCd' ? value.toUpperCase() : value
    }));
  };

  const submitEdit = async e => {
    e?.preventDefault();
    if (!editingId) return;
    setSavingId(editingId);
    setError('');
    setInfo('');
    try {
      const payload = {
        ...editForm,
        depotCd: normalizeCd(editForm.depotCd),
        stateCd: normalizeCd(editForm.stateCd),
        pin:     toNumOrUndef(editForm.pin)
      };
      if (!payload.depotCd || !payload.depotName) {
        setError('Depot Code and Depot Name are required');
        setSavingId(null);
        return;
      }

      // prevent changing code to an already-used one
      const clash = depots.find(
        d => normalizeCd(d.depotCd) === payload.depotCd && d._id !== editingId
      );
      if (clash) {
        setError(`Depot code "${payload.depotCd}" is already in use.`);
        setSavingId(null);
        return;
      }

      const res = await api.put(`/depots/${editingId}`, payload);
      setDepots(list => list.map(d => (d._id === editingId ? res.data : d)));
      setInfo(`Saved depot ${payload.depotCd}.`);
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this depot?')) return;
    setError('');
    setInfo('');
    try {
      await api.delete(`/depots/${id}`);
      setDepots(list => list.filter(d => d._id !== id));
      if (editingId === id) cancelEdit();
      setInfo('Depot deleted.');
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const filtered = depots.filter(d => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(d.depotCd || '').toLowerCase().includes(q) ||
      String(d.depotName || '').toLowerCase().includes(q) ||
      String(d.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 lg:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Create/Upsert Form (compact, sticky actions) */}
        <div className="bg-white rounded-lg shadow flex flex-col max-h-[85vh]">
          <div className="px-5 py-4 border-b">
            <h2 className="text-xl font-semibold">Depot Management</h2>
           
          </div>

          {(error || info) && (
            <div className="px-5 pt-3">
              {error && <div className="text-red-600 mb-2">{error}</div>}
              {info  && <div className="text-green-600 mb-2">{info}</div>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Depot Code</label>
                <input
                  name="depotCd"
                  value={form.depotCd}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. D01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Depot Name</label>
                <input
                  name="depotName"
                  value={form.depotName}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2"
                  placeholder="Main Depot"
                />
              </div>
            </div>

            <fieldset className="border border-gray-200 rounded">
              <legend className="text-sm font-semibold px-2">Address</legend>
              <div className="p-4 space-y-3">
                {['depotAdd1','depotAdd2','depotAdd3'].map((field, idx) => (
                  <input
                    key={field}
                    name={field}
                    value={form[field]}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder={`Address Line ${idx+1}`}
                  />
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input name="depotArea" value={form.depotArea} onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2" />
                  <input name="city"      value={form.city}      onChange={handleChange} placeholder="City" className="border rounded px-3 py-2" />
                  <input name="pin"       value={form.pin}       onChange={handleChange} placeholder="PIN Code" type="number" className="border rounded px-3 py-2" />
                </div>
                <input name="stateCd" value={form.stateCd} onChange={handleChange} placeholder="State Code" className="w-full border rounded px-3 py-2" />
              </div>
            </fieldset>
          </form>

          <div className="px-5 py-3 border-t">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {loading ? 'Saving…' : <span className="inline-flex items-center gap-2"><PlusIcon size={16}/> Save Depot</span>}
            </button>
          </div>
        </div>

        {/* Right: Search + Table (own scroll) */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col max-h-[85vh]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b">
            <h3 className="text-lg font-semibold">Existing Depots</h3>
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by code, name, city…"
                className="w-full border rounded pl-9 pr-3 py-2"
              />
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            </div>
          </div>

          <div className="overflow-auto mt-3">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Code','Name','City','PIN','Actions'].map((h,i)=>(
                    <th key={i} className="px-3 py-2 text-left text-xs sm:text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(d => (
                  <tr key={d._id} className="align-top hover:bg-gray-50">
                    {editingId === d._id ? (
                      <>
                        <td className="px-3 py-2">
                          <input
                            name="depotCd"
                            value={editForm.depotCd}
                            onChange={handleEditChange}
                            className="w-28 sm:w-32 border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="grid grid-cols-1 gap-2">
                            <input name="depotName" value={editForm.depotName} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="Depot Name"/>
                            <input name="depotAdd1" value={editForm.depotAdd1} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="Addr line 1"/>
                            <input name="depotAdd2" value={editForm.depotAdd2} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="Addr line 2"/>
                            <input name="depotAdd3" value={editForm.depotAdd3} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="Addr line 3"/>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="grid grid-cols-1 gap-2">
                            <input name="city" value={editForm.city} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="City"/>
                            <input name="depotArea" value={editForm.depotArea} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="Area"/>
                            <input name="stateCd" value={editForm.stateCd} onChange={handleEditChange} className="border rounded px-2 py-1" placeholder="State Code"/>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input name="pin" value={editForm.pin} onChange={handleEditChange} type="number" className="w-28 border rounded px-2 py-1" placeholder="PIN"/>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={submitEdit}
                              disabled={savingId === d._id}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1"
                              title="Save"
                            >
                              {savingId === d._id ? 'Saving…' : <><SaveIcon size={14}/> Save</>}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingId === d._id}
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
                        <td className="px-3 py-2 text-sm font-mono">{d.depotCd}</td>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium">{d.depotName}</div>
                          <div className="text-gray-600 text-xs whitespace-pre-line">
                            {[d.depotAdd1, d.depotAdd2, d.depotAdd3].filter(Boolean).join('\n')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div>{d.city || '—'}</div>
                          <div className="text-gray-600 text-xs">{d.depotArea}</div>
                          <div className="text-gray-600 text-xs">{d.stateCd}</div>
                        </td>
                        <td className="px-3 py-2 text-sm">{d.pin || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(d)}
                              className="px-2 py-1 bg-white border rounded hover:bg-gray-100 inline-flex items-center gap-1"
                              title="Edit"
                            >
                              <Edit2Icon size={14}/> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(d._id)}
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
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                      No depots found.
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
