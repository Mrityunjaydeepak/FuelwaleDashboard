import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  Search,
  RefreshCcw,
  Plus,
  Pencil,
  CheckCircle2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

/** keep in sync with backend enums */
const TRANS_TYPE = ['RECEIPT', 'PAYMENT', 'ADJUSTMENT'];
const PAY_MODE   = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER'];
const STATUS     = ['DRAFT', 'SUBMITTED']; // (DELETED is hidden by default)

export default function PaymentManager() {
  // list state
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ amount: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [transType, setTransType] = useState('ALL');
  const [mode, setMode] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // modal form state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(blankPayment());

  useEffect(() => {
    load();
    // eslint-disable-next-line 
  }, [page]); // page-based fetching

  const queryObj = useMemo(() => {
    const obj = { page, limit: 50 };
    if (q.trim()) obj.q = q.trim();
    if (status !== 'ALL') obj.status = status;
    if (transType !== 'ALL') obj.transType = transType;
    if (mode !== 'ALL') obj.mode = mode;
    if (from) obj.from = from;
    if (to) obj.to = to;
    return obj;
  }, [q, status, transType, mode, from, to, page]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get('/payments', { params: queryObj });
      const data = res.data?.data || res.data || [];
      setRows(data);
      // handle meta safely whether controller returned wrapper or plain list
      setPages(res.data?.pages || 1);
      setTotals(res.data?.totals || { amount: Array.isArray(data) ? data.reduce((s, r) => s + (Number(r.amount)||0), 0) : 0 });
    } catch (e) {
      console.error(e);
      setErr('Failed to load payments.');
      setRows([]);
      setPages(1);
      setTotals({ amount: 0 });
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setQ('');
    setStatus('ALL');
    setTransType('ALL');
    setMode('ALL');
    setFrom('');
    setTo('');
    setPage(1);
  }

  // create
  const openCreate = () => {
    setEditId(null);
    setForm(blankPayment());
    setOpen(true);
  };

  // edit (only DRAFT)
  const openEdit = (row) => {
    setEditId(row._id);
    setForm({
      transType: row.transType || 'RECEIPT',
      transName: row.transName || '',
      custCd: row.custCd || '',
      custName: row.custName || '',
      amount: row.amount ?? 0,
      mode: row.mode || 'CASH',
      refNo: row.refNo || '',
      remarks: row.remarks || '',
      txDate: row.txDate ? new Date(row.txDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
      orderId: row.orderId || '',
      tripId: row.tripId || '',
    });
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setEditId(null);
    setForm(blankPayment());
  };

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const canSave = useMemo(() => {
    return (
      form.transType &&
      form.amount !== '' &&
      !Number.isNaN(Number(form.amount)) &&
      Number(form.amount) >= 0 &&
      form.mode
    );
  }, [form]);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
      };
      if (editId) {
        await api.put(`/payments/${editId}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      closeModal();
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Failed to save payment.');
    } finally {
      setSaving(false);
    }
  };

  // actions on row
  const doReset = async (id) => {
    if (!window.confirm('Reset this payment back to blank values?')) return;
    try {
      await api.post(`/payments/${id}/reset`);
      await load();
    } catch (e) { console.error(e); alert('Reset failed.'); }
  };
  const doSubmit = async (id) => {
    if (!window.confirm('Submit this payment? You cannot modify it after submitting.')) return;
    try {
      await api.post(`/payments/${id}/submit`);
      await load();
    } catch (e) { console.error(e); alert(e?.response?.data?.error || 'Submit failed.'); }
  };
  const doDelete = async (id) => {
    if (!window.confirm('Delete (soft) this payment?')) return;
    try {
      await api.delete(`/payments/${id}`);
      await load();
    } catch (e) { console.error(e); alert('Delete failed.'); }
  };

  const chip = (s) => {
    const base = 'inline-block text-xs px-2 py-1 rounded border';
    if (s === 'DRAFT') return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>DRAFT</span>;
    if (s === 'SUBMITTED') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>SUBMITTED</span>;
    return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{s}</span>;
  };

  // client-side filtering (for UX snappiness) on top of server results
  const filtered = useMemo(() => {
    let arr = [...rows];
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter(r =>
        [
          r.transType, r.transName, r.custCd, r.custName, r.mode, r.refNo, r.remarks
        ].filter(Boolean).some(v => String(v).toLowerCase().includes(qq))
      );
    }
    return arr;
  }, [rows, q]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Payments</h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
        >
          <Plus size={16} /> New Payment
        </button>
        <button
          onClick={() => { setPage(1); load(); }}
          className="ml-auto inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {err && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{err}</div>}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex items-center border bg-white rounded px-2">
          <Search size={16} />
          <input
            placeholder="Search text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>

        <select className="border rounded px-2 py-1 bg-white" value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Status</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="border rounded px-2 py-1 bg-white" value={transType} onChange={(e)=>{ setTransType(e.target.value); setPage(1); }}>
          <option value="ALL">All Types</option>
          {TRANS_TYPE.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="border rounded px-2 py-1 bg-white" value={mode} onChange={(e)=>{ setMode(e.target.value); setPage(1); }}>
          <option value="ALL">All Modes</option>
          {PAY_MODE.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input type="date" className="border rounded px-2 py-1 bg-white" value={from} onChange={(e)=>{ setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="border rounded px-2 py-1 bg-white" value={to} onChange={(e)=>{ setTo(e.target.value); setPage(1); }} />

        <button className="border rounded px-3 py-1 bg-white hover:bg-gray-50" onClick={() => { resetFilters(); load(); }}>
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-[1100px] w-full">
          <thead>
            <tr className="bg-yellow-300">
              <Th>TransType</Th>
              <Th>TransName</Th>
              <Th>CustCd</Th>
              <Th>CustName</Th>
              <Th className="text-right">Amount</Th>
              <Th>Mode</Th>
              <Th>RefNo</Th>
              <Th>Remarks</Th>
              <Th>Date</Th>
              <Th>Status</Th>
              <Th className="text-center">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center" colSpan={11}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={11}>No payments found.</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <Td>{r.transType}</Td>
                  <Td>{r.transName || '—'}</Td>
                  <Td>{r.custCd || '—'}</Td>
                  <Td>{r.custName || '—'}</Td>
                  <Td className="text-right">{fmtINR(r.amount)}</Td>
                  <Td>{r.mode}</Td>
                  <Td>{r.refNo || '—'}</Td>
                  <Td className="max-w-[240px] truncate" title={r.remarks}>{r.remarks || '—'}</Td>
                  <Td>{r.txDate ? new Date(r.txDate).toLocaleDateString() : '—'}</Td>
                  <Td>{chip(r.status)}</Td>
                  <Td>
                    <div className="flex items-center justify-center gap-2">
                      {r.status === 'DRAFT' && (
                        <>
                          <button className="text-slate-700 hover:text-slate-900" title="Modify" onClick={() => openEdit(r)}>
                            <Pencil size={18} />
                          </button>
                          <button className="text-yellow-700 hover:text-yellow-900" title="Reset" onClick={() => doReset(r._id)}>
                            <RotateCcw size={18} />
                          </button>
                          <button className="text-green-700 hover:text-green-900" title="Submit" onClick={() => doSubmit(r._id)}>
                            <CheckCircle2 size={18} />
                          </button>
                        </>
                      )}
                      <button className="text-red-600 hover:text-red-800" title="Delete" onClick={() => doDelete(r._id)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>

          {/* footer total */}
          {!loading && filtered.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <Td className="font-semibold" colSpan={4}>Total</Td>
                <Td className="text-right font-semibold">{fmtINR(totals?.amount || 0)}</Td>
                <Td colSpan={6}></Td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          className="px-3 py-1 border rounded bg-white disabled:opacity-50"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <div className="text-sm text-gray-600">Page {page} / {pages}</div>
        <button
          className="px-3 py-1 border rounded bg-white disabled:opacity-50"
          onClick={() => setPage(p => Math.min(pages, p + 1))}
          disabled={page >= pages}
        >
          Next
        </button>
      </div>

      {/* Create / Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : closeModal} />
          <div className="relative z-10 w-[95%] md:w-[760px] bg-white rounded shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">{editId ? 'Modify Payment' : 'New Payment'}</h3>
              <button className="p-1 rounded hover:bg-gray-100" onClick={closeModal} disabled={saving} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField label="Trans Type" value={form.transType} onChange={(v)=>onChange('transType', v)} options={TRANS_TYPE} required />
              <TextField   label="Trans Name" value={form.transName} onChange={(v)=>onChange('transName', v)} placeholder="optional" />

              <TextField   label="Cust Code" value={form.custCd} onChange={(v)=>onChange('custCd', v)} placeholder="e.g. CUST001" />
              <TextField   label="Cust Name" value={form.custName} onChange={(v)=>onChange('custName', v)} />

              <NumberField label="Amount" value={form.amount} onChange={(v)=>onChange('amount', v)} required />
              <SelectField label="Mode" value={form.mode} onChange={(v)=>onChange('mode', v)} options={PAY_MODE} required />

              <TextField   label="Reference No." value={form.refNo} onChange={(v)=>onChange('refNo', v)} placeholder="UTR/Cheque/Txn id" />
              <DateField   label="Date" value={form.txDate} onChange={(v)=>onChange('txDate', v)} />

              <TextArea    label="Remarks" value={form.remarks} onChange={(v)=>onChange('remarks', v)} className="md:col-span-2" />

              {/* Optional linking */}
              <TextField   label="Order Id (optional)" value={form.orderId} onChange={(v)=>onChange('orderId', v)} placeholder="MongoId" />
              <TextField   label="Trip Id (optional)"  value={form.tripId}  onChange={(v)=>onChange('tripId', v)} placeholder="MongoId" />
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                      onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      onClick={onSave} disabled={saving || !canSave}>
                {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers & tiny components ---------- */
function blankPayment() {
  const today = new Date().toISOString().slice(0,10);
  return {
    transType: 'RECEIPT',
    transName: '',
    custCd: '',
    custName: '',
    amount: 0,
    mode: 'CASH',
    refNo: '',
    remarks: '',
    txDate: today,
    orderId: '',
    tripId: '',
  };
}

function fmtINR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold border border-black ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-3 py-2 border-t align-top ${className}`} {...rest}>
      {children}
    </td>
  );
}

function TextField({ label, value, onChange, placeholder = '', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function NumberField({ label, value, onChange, required = false, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="number"
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="0.01"
      />
    </div>
  );
}
function DateField({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function SelectField({ label, value, onChange, options, required = false, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        className="w-full border rounded px-3 py-2 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
function TextArea({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <textarea
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}
