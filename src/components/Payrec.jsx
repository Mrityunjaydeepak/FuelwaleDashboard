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
    mgr: '',              // <<< NEW
    status: 'ACTIVE'
  };

  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fromDt, setFromDt] = useState('');
  const [toDt, setToDt] = useState('');
  const [fltTrType, setFltTrType] = useState('');
  const [fltStatus, setFltStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

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

  useEffect(() => { loadRows().catch(() => setError('Failed to load records')); }, []);

  const filtered = useMemo(() => {
    let arr = [...rows];
    if (fromDt) arr = arr.filter((x) => new Date(x.date).getTime() >= new Date(fromDt).getTime());
    if (toDt)   arr = arr.filter((x) => new Date(x.date).getTime() <= new Date(toDt).getTime());
    if (fltTrType) arr = arr.filter((x) => x.trType === fltTrType);
    if (fltStatus) arr = arr.filter((x) => x.status === fltStatus);
    if (q) {
      const qq = q.toLowerCase();
      arr = arr.filter((x) =>
        [x.partyCode, x.partyName, x.forPartyCode, x.forPartyName, x.refNo, x.remarks, x.mgr]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(qq))
      );
    }
    return arr;
  }, [rows, fromDt, toDt, fltTrType, fltStatus, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const view = filtered.slice((page - 1) * limit, page * limit);

  // Create
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payrec', {
        date:        form.date || undefined,
        trType:      form.trType,
        partyCode:   form.partyCode,
        partyName:   form.partyName || undefined,
        forPartyCode: is1to4(form.trType) ? undefined : form.forPartyCode || undefined,
        forPartyName: is1to4(form.trType) ? undefined : form.forPartyName || undefined,
        mode:        form.mode,
        refNo:       form.refNo || undefined,
        amount:      numOrUndefined(form.amount),
        remarks:     form.remarks || undefined,
        mgr:         form.mgr || undefined,          // <<< send Mgr
        status:      form.status || 'ACTIVE'
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

  // Soft delete / restore / status
  const handleDelete = async (id) => {
    if (!window.confirm('Soft delete this entry?')) return;
    try { await api.delete(`/payrec/${id}`); await loadRows(); }
    catch { alert('Failed to delete'); }
  };
  const handleRestore = async (id) => {
    try { await api.patch(`/payrec/${id}/restore`); await loadRows(); }
    catch { alert('Failed to restore'); }
  };
  const handleStatus = async (id, newStatus) => {
    try { await api.patch(`/payrec/${id}/status`, { status: newStatus }); await loadRows(); }
    catch { alert('Failed to update status'); }
  };

  // Edit
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
      mgr:           r.mgr || '',                // <<< load Mgr
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

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload = {
        date:        editForm.date || undefined,
        trType:      editForm.trType,
        partyCode:   editForm.partyCode,
        partyName:   editForm.partyName || undefined,
        forPartyCode: is1to4(editForm.trType) ? undefined : editForm.forPartyCode || undefined,
        forPartyName: is1to4(editForm.trType) ? undefined : editForm.forPartyName || undefined,
        mode:        editForm.mode,
        refNo:       editForm.refNo || undefined,
        amount:      numOrUndefined(editForm.amount),
        remarks:     editForm.remarks || undefined,
        mgr:         editForm.mgr || undefined,      // <<< update Mgr
        status:      editForm.status || 'ACTIVE'
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

  const newForPartyDisabled = is1to4(form.trType);
  const editForPartyDisabled = is1to4(editForm.trType);

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <WalletIcon size={24} /> Accounts — PAY/REC
        </h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block mb-1 font-semibold">From</label>
            <input type="date" value={fromDt} onChange={(e)=>setFromDt(e.target.value)}
                   className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
          </div>
          <div>
            <label className="block mb-1 font-semibold">To</label>
            <input type="date" value={toDt} onChange={(e)=>setToDt(e.target.value)}
                   className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
          </div>
          <div>
            <label className="block mb-1 font-semibold">Tr Type</label>
            <select value={fltTrType} onChange={(e)=>setFltTrType(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500">
              <option value="">All</option>
              {TR_TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-semibold">Status</label>
            <select value={fltStatus} onChange={(e)=>setFltStatus(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500">
              <option value="">Active/Posted (default)</option>
              {STATUSES.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block mb-1 font-semibold">Search</label>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="party, forParty, refNo, remarks, mgr…"
                   className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
          </div>
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {/* Create Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 font-semibold">Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Transaction Type</label>
              <select name="trType" value={form.trType} onChange={handleChange}
                      className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500">
                {TR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Mode</label>
              <select name="mode" value={form.mode} onChange={handleChange}
                      className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500">
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Status</label>
              <select name="status" value={form.status} onChange={handleChange}
                      className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500">
                {STATUSES.filter(s => s.value !== 'DELETED').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold">Party Code</label>
              <input name="partyCode" value={form.partyCode} onChange={handleChange} required placeholder="CUST001"
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Party Name</label>
              <input name="partyName" value={form.partyName} onChange={handleChange} placeholder="ABC Fuels"
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>

            <div>
              <label className="block mb-1 font-semibold">For Party Code</label>
              <input
                name="forPartyCode"
                value={is1to4(form.trType) ? form.partyCode : form.forPartyCode}
                onChange={handleChange}
                placeholder={is1to4(form.trType) ? 'Auto = Party Code' : 'CUST002'}
                disabled={is1to4(form.trType)}
                className={`w-full border rounded px-3 py-2 ${is1to4(form.trType) ? 'bg-gray-100' : 'focus:ring-2 focus:ring-green-500'}`}
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold">For Party Name</label>
              <input
                name="forPartyName"
                value={is1to4(form.trType) ? form.partyName : form.forPartyName}
                onChange={handleChange}
                placeholder={is1to4(form.trType) ? 'Auto = Party Name' : 'XYZ Logistics'}
                disabled={is1to4(form.trType)}
                className={`w-full border rounded px-3 py-2 ${is1to4(form.trType) ? 'bg-gray-100' : 'focus:ring-2 focus:ring-green-500'}`}
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold">Ref No</label>
              <input name="refNo" value={form.refNo} onChange={handleChange} placeholder="NEFT/UTR etc."
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Amount</label>
              <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} required
                     placeholder="0.00" className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>

            {/* NEW: Manager */}
            <div>
              <label className="block mb-1 font-semibold">Mgr (Manager)</label>
              <input name="mgr" value={form.mgr} onChange={handleChange} placeholder="Manager name / ID"
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>

            <div className="md:col-span-3">
              <label className="block mb-1 font-semibold">Remarks</label>
              <input name="remarks" value={form.remarks} onChange={handleChange} placeholder="Notes…"
                     className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"/>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mt-2">
            <button type="submit" disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              {loading ? 'Adding…' : (<><PlusIcon size={16}/> Add</>)}
            </button>
            <button type="button" onClick={() => { setForm(initialForm); }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
              Clear
            </button>
            <button type="button" onClick={() => { window.location.href = '/'; }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
              Save &amp; Exit
            </button>
          </div>
        </form>
      </div>

      {/* TABLE */}
      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h3 className="text-xl font-medium mb-4">PAY/REC Entries</h3>

        <div className="flex items-center gap-2 mb-3">
          <button className="px-3 py-1 border rounded disabled:opacity-50"
                  onClick={()=> setPage((p)=> Math.max(1, p-1))}
                  disabled={page<=1}>Prev</button>
          <span className="text-sm">Page {page} / {pages}</span>
          <button className="px-3 py-1 border rounded disabled:opacity-50"
                  onClick={()=> setPage((p)=> Math.min(pages, p+1))}
                  disabled={page>=pages}>Next</button>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left text-sm font-semibold">#</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Date</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Tr Type</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Party (Code / Name)</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">For Party (Code / Name)</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Mode</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Ref No</th>
              <th className="px-3 py-2 text-right text-sm font-semibold">Amount</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Remarks</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Mgr</th> {/* NEW column */}
              <th className="px-3 py-2 text-left text-sm font-semibold">Status</th>
              <th className="px-3 py-2 text-left text-sm font-semibold">Created</th>
              <th className="px-3 py-2 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {view.map((r, idx) => (
              <tr key={r._id} className="hover:bg-gray-50">
                {editingId === r._id ? (
                  <>
                    <td className="px-3 py-2 text-sm">{(page-1)*limit + idx + 1}</td>
                    <td className="px-3 py-2">
                      <input type="date" name="date" value={editForm.date} onChange={handleEditChange}
                             className="w-full border rounded px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2">
                      <select name="trType" value={editForm.trType} onChange={handleEditChange}
                              className="w-full border rounded px-2 py-1">
                        {TR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid grid-cols-1 gap-1">
                        <input name="partyCode" value={editForm.partyCode} onChange={handleEditChange}
                               placeholder="CUST001" className="w-full border rounded px-2 py-1"/>
                        <input name="partyName" value={editForm.partyName} onChange={handleEditChange}
                               placeholder="ABC Fuels" className="w-full border rounded px-2 py-1"/>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid grid-cols-1 gap-1">
                        <input name="forPartyCode"
                               value={is1to4(editForm.trType) ? editForm.partyCode : editForm.forPartyCode}
                               onChange={handleEditChange}
                               placeholder={is1to4(editForm.trType) ? 'Auto' : 'CUST002'}
                               disabled={is1to4(editForm.trType)}
                               className={`w-full border rounded px-2 py-1 ${is1to4(editForm.trType) ? 'bg-gray-100' : ''}`}/>
                        <input name="forPartyName"
                               value={is1to4(editForm.trType) ? editForm.partyName : editForm.forPartyName}
                               onChange={handleEditChange}
                               placeholder={is1to4(editForm.trType) ? 'Auto' : 'XYZ Logistics'}
                               disabled={is1to4(editForm.trType)}
                               className={`w-full border rounded px-2 py-1 ${is1to4(editForm.trType) ? 'bg-gray-100' : ''}`}/>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select name="mode" value={editForm.mode} onChange={handleEditChange}
                              className="w-full border rounded px-2 py-1">
                        {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input name="refNo" value={editForm.refNo} onChange={handleEditChange}
                             placeholder="UTR/NEFT/…" className="w-full border rounded px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" name="amount" value={editForm.amount} onChange={handleEditChange}
                             className="w-full border rounded px-2 py-1 text-right"/>
                    </td>
                    <td className="px-3 py-2">
                      <input name="remarks" value={editForm.remarks} onChange={handleEditChange}
                             className="w-full border rounded px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2">
                      <input name="mgr" value={editForm.mgr} onChange={handleEditChange} placeholder="Manager"
                             className="w-full border rounded px-2 py-1"/>
                    </td>
                    <td className="px-3 py-2">
                      <select name="status" value={editForm.status} onChange={handleEditChange}
                              className="w-full border rounded px-2 py-1">
                        {STATUSES.filter(s => s.value !== 'DELETED').map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-sm">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2 flex justify-center gap-2">
                      <button onClick={submitEdit} disabled={editLoading} className="p-2 hover:bg-gray-100 rounded" title="Save">
                        <SaveIcon size={16}/>
                      </button>
                      <button onClick={cancelEdit} disabled={editLoading} className="p-2 hover:bg-gray-100 rounded" title="Cancel">
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
                        <div className="text-gray-500">{r.partyName || '–'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="leading-tight">
                        <div className="font-mono">{r.forPartyCode || '–'}</div>
                        <div className="text-gray-500">{r.forPartyName || '–'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">{MODES.find(m=>m.value===r.mode)?.label || r.mode}</td>
                    <td className="px-3 py-2 text-sm">{r.refNo || '–'}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {r.amount?.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) ?? '0.00'}
                    </td>
                    <td className="px-3 py-2 text-sm">{r.remarks || '–'}</td>
                    <td className="px-3 py-2 text-sm">{r.mgr || '–'}</td> {/* show Mgr */}
                    <td className="px-3 py-2 text-sm">{r.status}</td>
                    <td className="px-3 py-2 text-sm">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2 flex justify-center gap-2">
                      {r.status !== 'DELETED' ? (
                        <>
                          <button onClick={()=> startEdit(r)} className="p-2 hover:bg-gray-100 rounded" title="Edit">
                            <Edit2Icon size={16}/>
                          </button>
                          <button onClick={()=> handleStatus(r._id, r.status === 'ACTIVE' ? 'POSTED' : 'ACTIVE')}
                                  className="p-2 hover:bg-gray-100 rounded"
                                  title={r.status === 'ACTIVE' ? 'Mark Posted' : 'Mark Active'}>
                            <BadgeCheckIcon size={16}/>
                          </button>
                          <button onClick={()=> handleDelete(r._id)} className="p-2 hover:bg-red-100 rounded" title="Soft Delete">
                            <Trash2Icon size={16}/>
                          </button>
                        </>
                      ) : (
                        <button onClick={()=> handleRestore(r._id)} className="p-2 hover:bg-gray-100 rounded" title="Restore">
                          <RotateCcwIcon size={16}/>
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!view.length && (
              <tr>
                <td colSpan="13" className="px-4 py-6 text-center text-sm text-gray-500">
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
