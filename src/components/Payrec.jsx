// src/components/PayRecManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  WalletIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon,
  RotateCcwIcon,
  BadgeCheckIcon
} from 'lucide-react';

const TR_TYPES = [
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'DR', label: 'Dr' },
  { value: 'CR', label: 'Cr' },
  { value: '3P_RECEIPT', label: '3P Receipt' },
  { value: '3P_PAYMENT', label: '3P Payment' }
];

const MODES = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'ADJ_DR', label: 'Adj (Dr)' },
  { value: 'ADJ_CR', label: 'Adj (Cr)' }
];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'DELETED', label: 'Deleted' }
];

export default function PayRecManagement() {
  const initialForm = {
    date: '',
    trType: 'RECEIPT',
    partyCode: '',
    partyName: '',
    forPartyCode: '',
    forPartyName: '',
    mode: 'BANK',
    refNo: '',
    amount: '',
    remarks: '',
    status: 'ACTIVE'
  };

  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // customers for dropdowns
  const [customers, setCustomers] = useState([]);

  // Filters
  const [fromDt, setFromDt] = useState('');
  const [toDt, setToDt] = useState('');
  const [fltTrType, setFltTrType] = useState('');
  const [fltStatus, setFltStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  const numOrUndefined = (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const toDateInput = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '–');
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '–');
  const is1to4 = (tt) => ['RECEIPT','PAYMENT','DR','CR'].includes(tt);

  const loadRows = async () => {
    const params = new URLSearchParams();
    if (fromDt) params.set('from', fromDt);
    if (toDt) params.set('to', toDt);
    if (fltTrType) params.set('trType', fltTrType);
    if (q) params.set('q', q);
    if (fltStatus) params.set('status', fltStatus);
    params.set('page', '1');
    params.set('limit', '200');
    const r = await api.get(`/payrec?${params.toString()}`);
    setRows(r.data?.items || []);
  };

  useEffect(() => {
    // load rows
    loadRows().catch(() => setError('Failed to load records'));
    // load customers for dropdowns
    api.get('/customers')
      .then(r => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, []);

  // quick index for code/name lookups
  const byCode = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.custCd, c));
    return m;
  }, [customers]);
  const byName = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.custName, c));
    return m;
  }, [customers]);

  // Apply client-side filters too (snappy UI)
  const filtered = useMemo(() => {
    let arr = [...rows];
    if (fromDt) arr = arr.filter((x) => new Date(x.date).getTime() >= new Date(fromDt).getTime());
    if (toDt)   arr = arr.filter((x) => new Date(x.date).getTime() <= new Date(toDt).getTime());
    if (fltTrType) arr = arr.filter((x) => x.trType === fltTrType);
    if (fltStatus) arr = arr.filter((x) => x.status === fltStatus);
    if (q) {
      const qq = q.toLowerCase();
      arr = arr.filter((x) =>
        [x.partyCode, x.partyName, x.forPartyCode, x.forPartyName, x.refNo, x.remarks]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(qq))
      );
    }
    return arr;
  }, [rows, fromDt, toDt, fltTrType, fltStatus, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const view = filtered.slice((page - 1) * limit, page * limit);

  // ---- CREATE HANDLERS ----
  const newForPartyDisabled = is1to4(form.trType);
  const editForPartyDisabled = is1to4(editForm.trType);

  // changing any regular input
  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      if (name === 'trType' && is1to4(value)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      if (name === 'partyCode' && is1to4(f.trType)) next.forPartyCode = value;
      if (name === 'partyName' && is1to4(f.trType)) next.forPartyName = value;
      return next;
    });
    setError('');
  };

  // Party dropdown changes (code + name kept in sync)
  const handlePartyCodeSelect = (e) => {
    const code = e.target.value;
    const c = byCode.get(code);
    setForm(f => {
      const next = { ...f, partyCode: code, partyName: c?.custName || '' };
      if (is1to4(f.trType)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      return next;
    });
  };
  const handlePartyNameSelect = (e) => {
    const name = e.target.value;
    const c = byName.get(name);
    setForm(f => {
      const next = { ...f, partyName: name, partyCode: c?.custCd || '' };
      if (is1to4(f.trType)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      return next;
    });
  };

  // For Party dropdown changes (only when enabled)
  const handleForPartyCodeSelect = (e) => {
    const code = e.target.value;
    const c = byCode.get(code);
    setForm(f => ({ ...f, forPartyCode: code, forPartyName: c?.custName || '' }));
  };
  const handleForPartyNameSelect = (e) => {
    const name = e.target.value;
    const c = byName.get(name);
    setForm(f => ({ ...f, forPartyName: name, forPartyCode: c?.custCd || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payrec', {
        date:         form.date || undefined,
        trType:       form.trType,
        partyCode:    form.partyCode,
        partyName:    form.partyName || undefined,
        forPartyCode: is1to4(form.trType) ? undefined : form.forPartyCode || undefined,
        forPartyName: is1to4(form.trType) ? undefined : form.forPartyName || undefined,
        mode:         form.mode,
        refNo:        form.refNo || undefined,
        amount:       numOrUndefined(form.amount),
        remarks:      form.remarks || undefined,
        status:       form.status || 'ACTIVE'
      });
      await loadRows();
      setForm(initialForm);
      setPage(1);
    } catch (err) {
      console.error('Create error', err.response || err);
      setError(err.response?.data?.error || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  // ---- EDIT HANDLERS ----
  const startEdit = (r) => {
    setEditingId(r._id);
    setEditForm({
      date:          toDateInput(r.date),
      trType:        r.trType,
      partyCode:     r.partyCode || '',
      partyName:     r.partyName || '',
      forPartyCode:  r.forPartyCode || '',
      forPartyName:  r.forPartyName || '',
      mode:          r.mode || 'BANK',
      refNo:         r.refNo || '',
      amount:        (r.amount ?? '').toString(),
      remarks:       r.remarks || '',
      status:        r.status || 'ACTIVE'
    });
    setError('');
  };
  const cancelEdit = () => { setEditingId(null); setError(''); };
  const handleEditChange = (e) => {
    const { name, type, value, checked } = e.target;
    setEditForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      if (name === 'trType' && is1to4(value)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      if (name === 'partyCode' && is1to4(f.trType)) next.forPartyCode = value;
      if (name === 'partyName' && is1to4(f.trType)) next.forPartyName = value;
      return next;
    });
    setError('');
  };

  // Edit synced dropdowns
  const handleEditPartyCodeSelect = (e) => {
    const code = e.target.value;
    const c = byCode.get(code);
    setEditForm(f => {
      const next = { ...f, partyCode: code, partyName: c?.custName || '' };
      if (is1to4(f.trType)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      return next;
    });
  };
  const handleEditPartyNameSelect = (e) => {
    const name = e.target.value;
    const c = byName.get(name);
    setEditForm(f => {
      const next = { ...f, partyName: name, partyCode: c?.custCd || '' };
      if (is1to4(f.trType)) {
        next.forPartyCode = next.partyCode;
        next.forPartyName = next.partyName;
      }
      return next;
    });
  };
  const handleEditForPartyCodeSelect = (e) => {
    const code = e.target.value;
    const c = byCode.get(code);
    setEditForm(f => ({ ...f, forPartyCode: code, forPartyName: c?.custName || '' }));
  };
  const handleEditForPartyNameSelect = (e) => {
    const name = e.target.value;
    const c = byName.get(name);
    setEditForm(f => ({ ...f, forPartyName: name, forPartyCode: c?.custCd || '' }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload = {
        date:         editForm.date || undefined,
        trType:       editForm.trType,
        partyCode:    editForm.partyCode,
        partyName:    editForm.partyName || undefined,
        forPartyCode: is1to4(editForm.trType) ? undefined : editForm.forPartyCode || undefined,
        forPartyName: is1to4(editForm.trType) ? undefined : editForm.forPartyName || undefined,
        mode:         editForm.mode,
        refNo:        editForm.refNo || undefined,
        amount:       numOrUndefined(editForm.amount),
        remarks:      editForm.remarks || undefined,
        status:       editForm.status || 'ACTIVE'
      };
      const res = await api.put(`/payrec/${editingId}`, payload);
      setRows((rs) => rs.map((r) => (r._id === editingId ? res.data : r)));
      setEditingId(null);
    } catch (err) {
      console.error('Edit error', err.response || err);
      setError(err.response?.data?.error || 'Failed to update entry');
    } finally {
      setEditLoading(false);
    }
  };

  const StatusPill = ({ value }) => {
    const map = {
      ACTIVE: 'bg-emerald-100 text-emerald-800',
      POSTED: 'bg-blue-100 text-blue-800',
      DELETED: 'bg-red-100 text-red-800'
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[value] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
  };

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-white min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <WalletIcon size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Accounts — PAY/REC</h2>
          <p className="text-sm text-slate-500">Manage receipts, payments and adjustments</p>
        </div>
      </div>

      {/* FILTERS CARD */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold">Filters</h3>
          <div className="text-xs text-slate-500">Showing {filtered.length} result(s)</div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">From</label>
              <input type="date" value={fromDt} onChange={(e)=>setFromDt(e.target.value)}
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">To</label>
              <input type="date" value={toDt} onChange={(e)=>setToDt(e.target.value)}
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Tr Type</label>
              <select value={fltTrType} onChange={(e)=>setFltTrType(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
                <option value="">All</option>
                {TR_TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Status</label>
              <select value={fltStatus} onChange={(e)=>setFltStatus(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
                <option value="">Active/Posted</option>
                {STATUSES.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1 text-sm font-medium text-slate-600">Search</label>
              <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="party, forParty, refNo, remarks…"
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => { setFromDt(''); setToDt(''); setFltTrType(''); setFltStatus(''); setQ(''); setPage(1); }}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
            >
              Clear Filters
            </button>
            <button
              onClick={() => loadRows()}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold">Create New Entry</h3>
        </div>

        {error && <div className="px-5 pt-4 text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Transaction Type</label>
              <select name="trType" value={form.trType} onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
                {TR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Mode</label>
              <select name="mode" value={form.mode} onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Status</label>
              <select name="status" value={form.status} onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
                {STATUSES.filter(s => s.value !== 'DELETED').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Party (Code & Name dropdowns; selecting one fills the other) */}
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Party Code</label>
              <select
                value={form.partyCode}
                onChange={handlePartyCodeSelect}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select code…</option>
                {customers.map(c => (
                  <option key={c._id} value={c.custCd}>{c.custCd}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Party Name</label>
              <select
                value={form.partyName}
                onChange={handlePartyNameSelect}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select name…</option>
                {customers.map(c => (
                  <option key={c._id} value={c.custName}>{c.custName}</option>
                ))}
              </select>
            </div>

            {/* For Party (auto = Party for 1..4; otherwise own synced dropdowns) */}
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">For Party Code</label>
              {newForPartyDisabled ? (
                <input
                  value={form.partyCode}
                  disabled
                  className="w-full border rounded-lg px-3 py-2 bg-gray-100"
                />
              ) : (
                <select
                  value={form.forPartyCode}
                  onChange={handleForPartyCodeSelect}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select code…</option>
                  {customers.map(c => (
                    <option key={c._id} value={c.custCd}>{c.custCd}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">For Party Name</label>
              {newForPartyDisabled ? (
                <input
                  value={form.partyName}
                  disabled
                  className="w-full border rounded-lg px-3 py-2 bg-gray-100"
                />
              ) : (
                <select
                  value={form.forPartyName}
                  onChange={handleForPartyNameSelect}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select name…</option>
                  {customers.map(c => (
                    <option key={c._id} value={c.custName}>{c.custName}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Ref No</label>
              <input name="refNo" value={form.refNo} onChange={handleChange} placeholder="NEFT/UTR etc."
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-600">Amount</label>
              <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} required
                     placeholder="0.00" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>

            <div className="md:col-span-2">
              <label className="block mb-1 text-sm font-medium text-slate-600">Remarks</label>
              <input name="remarks" value={form.remarks} onChange={handleChange} placeholder="Notes…"
                     className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"/>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-2">
            <button type="submit" disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              {loading ? 'Adding…' : (<><PlusIcon size={16}/> Add</>)}
            </button>
            <button type="button" onClick={() => { setForm(initialForm); }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-slate-50">
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* TABLE */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow border border-slate-100 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold">PAY/REC Entries</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                    onClick={()=> setPage((p)=> Math.max(1, p-1))}
                    disabled={page<=1}>Prev</button>
            <span className="text-sm text-slate-600">Page {page} / {pages}</span>
            <button className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                    onClick={()=> setPage((p)=> Math.min(pages, p+1))}
                    disabled={page>=pages}>Next</button>
          </div>
        </div>

        <table className="min-w-full">
          <thead>
            <tr className="bg-emerald-50 text-emerald-900">
              <th className="px-3 py-2 text-left text-sm font-semibold">#</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Date</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Tr Type</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Party (Code / Name)</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">For Party (Code / Name)</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Mode</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Ref No</th>
              <th className="px-3 py-2 text-right text-sm font-semibold">Amount</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Remarks</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Status</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Created</th>
              <th className="px-3 py-2 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.map((r, idx) => (
              <tr key={r._id} className="hover:bg-slate-50">
                {editingId === r._id ? (
                  <>
                    <td className="px-3 py-2 text-sm">{(page-1)*limit + idx + 1}</td>
                    <td className="px-3 py-2">
                      <input type="date" name="date" value={editForm.date} onChange={handleEditChange}
                             className="w-full border rounded-lg px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2">
                      <select name="trType" value={editForm.trType} onChange={handleEditChange}
                              className="w-full border rounded-lg px-2 py-1">
                        {TR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>

                    {/* EDIT: Party dropdowns */}
                    <td className="px-3 py-2">
                      <div className="grid grid-cols-1 gap-1">
                        <select
                          value={editForm.partyCode}
                          onChange={handleEditPartyCodeSelect}
                          className="w-full border rounded-lg px-2 py-1"
                        >
                          <option value="">Code…</option>
                          {customers.map(c => (
                            <option key={c._id} value={c.custCd}>{c.custCd}</option>
                          ))}
                        </select>
                        <select
                          value={editForm.partyName}
                          onChange={handleEditPartyNameSelect}
                          className="w-full border rounded-lg px-2 py-1"
                        >
                          <option value="">Name…</option>
                          {customers.map(c => (
                            <option key={c._id} value={c.custName}>{c.custName}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* EDIT: For Party dropdowns / mirror */}
                    <td className="px-3 py-2">
                      {editForPartyDisabled ? (
                        <div className="grid grid-cols-1 gap-1">
                          <input value={editForm.partyCode} disabled className="w-full border rounded-lg px-2 py-1 bg-gray-100"/>
                          <input value={editForm.partyName} disabled className="w-full border rounded-lg px-2 py-1 bg-gray-100"/>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1">
                          <select
                            value={editForm.forPartyCode}
                            onChange={handleEditForPartyCodeSelect}
                            className="w-full border rounded-lg px-2 py-1"
                          >
                            <option value="">Code…</option>
                            {customers.map(c => (
                              <option key={c._id} value={c.custCd}>{c.custCd}</option>
                            ))}
                          </select>
                          <select
                            value={editForm.forPartyName}
                            onChange={handleEditForPartyNameSelect}
                            className="w-full border rounded-lg px-2 py-1"
                          >
                            <option value="">Name…</option>
                            {customers.map(c => (
                              <option key={c._id} value={c.custName}>{c.custName}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <select name="mode" value={editForm.mode} onChange={handleEditChange}
                              className="w-full border rounded-lg px-2 py-1">
                        {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input name="refNo" value={editForm.refNo} onChange={handleEditChange}
                             placeholder="UTR/NEFT/…" className="w-full border rounded-lg px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" name="amount" value={editForm.amount} onChange={handleEditChange}
                             className="w-full border rounded-lg px-2 py-1 text-right"/>
                    </td>
                    <td className="px-3 py-2">
                      <input name="remarks" value={editForm.remarks} onChange={handleEditChange}
                             className="w-full border rounded-lg px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2">
                      <select name="status" value={editForm.status} onChange={handleEditChange}
                              className="w-full border rounded-lg px-2 py-1">
                        {STATUSES.filter(s => s.value !== 'DELETED').map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-sm">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2 flex justify-center gap-2">
                      <button onClick={submitEdit} disabled={editLoading} className="p-2 hover:bg-slate-100 rounded-lg" title="Save">
                        <SaveIcon size={16}/>
                      </button>
                      <button onClick={cancelEdit} disabled={editLoading} className="p-2 hover:bg-slate-100 rounded-lg" title="Cancel">
                        <XIcon size={16}/>
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-sm">{(page-1)*limit + idx + 1}</td>
                    <td className="px-3 py-2 text-sm">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-sm">{TR_TYPES.find(t=>t.value===r.trType)?.label || r.trType}</td>
                    <td className="px-3 py-2 text-sm">
                      <div className="leading-tight">
                        <div className="font-mono">{r.partyCode}</div>
                        <div className="text-slate-500">{r.partyName || '–'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="leading-tight">
                        <div className="font-mono">{r.forPartyCode || '–'}</div>
                        <div className="text-slate-500">{r.forPartyName || '–'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">{MODES.find(m=>m.value===r.mode)?.label || r.mode}</td>
                    <td className="px-3 py-2 text-sm">{r.refNo || '–'}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {r.amount?.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) ?? '0.00'}
                    </td>
                    <td className="px-3 py-2 text-sm">{r.remarks || '–'}</td>
                    <td className="px-3 py-2 text-sm"><StatusPill value={r.status} /></td>
                    <td className="px-3 py-2 text-sm">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        {r.status !== 'DELETED' ? (
                          <>
                            <button onClick={()=> startEdit(r)} className="p-2 hover:bg-slate-100 rounded-lg" title="Edit">
                              <Edit2Icon size={16}/>
                            </button>
                            <button onClick={()=> handleStatus(r._id, r.status === 'ACTIVE' ? 'POSTED' : 'ACTIVE')}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                    title={r.status === 'ACTIVE' ? 'Mark Posted' : 'Mark Active'}>
                              <BadgeCheckIcon size={16}/>
                            </button>
                            <button onClick={()=> handleDelete(r._id)} className="p-2 hover:bg-red-100 rounded-lg" title="Soft Delete">
                              <Trash2Icon size={16}/>
                            </button>
                          </>
                        ) : (
                          <button onClick={()=> handleRestore(r._id)} className="p-2 hover:bg-slate-100 rounded-lg" title="Restore">
                            <RotateCcwIcon size={16}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!view.length && (
              <tr>
                <td colSpan="12" className="px-4 py-6 text-center text-sm text-slate-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
