// src/components/TripListings.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  Search,
  RefreshCcw,
  Play,
  Square,
  FileText,
  Trash2,
  X
} from 'lucide-react';

const STATUS = ['ASSIGNED', 'ACTIVE', 'COMPLETED'];

export default function TripListings() {
  const [trips, setTrips] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [routesMap, setRoutesMap] = useState({});

  const [filtered, setFiltered] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Start/End modals
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start fields
  const [selTrip, setSelTrip] = useState(null);
  const [startKm, setStartKm] = useState('');
  const [totalizerStart, setTotalizerStart] = useState('');
  const [routeId, setRouteId] = useState('');
  const [remarks, setRemarks] = useState('');

  // End fields
  const [endKm, setEndKm] = useState('');
  const [totalizerEnd, setTotalizerEnd] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setErr(null);
    try {
      const [tripsRes, ordersRes, customersRes, routesRes] = await Promise.all([
        api.get('/trips'),
        api.get('/orders'),
        api.get('/customers'),
        api.get('/routes').catch(() => ({ data: [] }))
      ]);

      const list = (tripsRes.data || []).map(t => ({
        ...t,
        createdAt: t.createdAt || t._id?.toString().slice(0,8) // fallback
      }));

      setTrips(list);
      setOrders(ordersRes.data || []);
      setCustomers(customersRes.data || []);

      // routes map (for start modal)
      const rmap = {};
      (routesRes.data || []).forEach(r => { rmap[String(r._id)] = r.name || '—'; });
      setRoutesMap(rmap);
    } catch (e) {
      console.error(e);
      setErr('Failed to load trips. Please try again.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  // Helper maps
  const ordersById = useMemo(() => {
    const m = new Map();
    (orders || []).forEach(o => m.set(String(o._id), o));
    return m;
  }, [orders]);

  const customersById = useMemo(() => {
    const m = new Map();
    (customers || []).forEach(c => m.set(String(c._id), c));
    return m;
  }, [customers]);

  // Build display rows combining Trip + Order + Customer
  const rows = useMemo(() => {
    return (trips || []).map(t => {
      const order = ordersById.get(String(t.orderId)) || {};
      const custId =
        typeof order.customer === 'object'
          ? order.customer?._id
          : order.customer;
      const cust = customersById.get(String(custId)) || {};

      const firstItem = Array.isArray(order.items) ? (order.items[0] || {}) : {};
      const totalQty = Array.isArray(order.items)
        ? order.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
        : null;

      const dateDely = order.deliveryDate || order.expectedDate || t.loginTime || t.createdAt || null;
      const timeSlot = order.timeSlot || order.deliverySlot || order.slot || '';

      return {
        _id: t._id,
        tripNo: t.tripNo,
        createdAt: t.createdAt,
        status: t.status,

        custId: cust.custCd || cust.customerCode || '—',
        custName: cust.custName || cust.name || '—',
        shipToLoc: order.shipToAddress || order.shipTo || '—',

        pdtCode: firstItem.productCode || firstItem.productId || '—',
        pdtName: firstItem.productName || '—',
        pdtQty: totalQty ?? firstItem.quantity ?? '—',
        uom: firstItem.uom || 'Liter',

        dateDely,
        timeSlot,
        orderStatus: order.orderStatus || '—',

        vehicleAllotted: t?.snapshot?.vehicleNo || '—',
        routeId: t.routeId
      };
    });
  }, [trips, ordersById, customersById]);

  // Filtering + sort
  useEffect(() => {
    let tmp = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      tmp = tmp.filter(r =>
        [
          r.tripNo,
          r.custId,
          r.custName,
          r.shipToLoc,
          r.pdtCode,
          r.pdtName,
          r.vehicleAllotted,
          r.orderStatus
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'ALL') {
      tmp = tmp.filter(r => r.status === statusFilter);
    }

    if (from) {
      const f = new Date(from);
      tmp = tmp.filter(r => new Date(r.createdAt) >= f);
    }
    if (to) {
      const tt = new Date(to);
      tt.setHours(23, 59, 59, 999);
      tmp = tmp.filter(r => new Date(r.createdAt) <= tt);
    }

    // Sort: ACTIVE first, then ASSIGNED, then COMPLETED, newest first
    const rank = { ACTIVE: 0, ASSIGNED: 1, COMPLETED: 2 };
    tmp.sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    setFiltered(tmp);
  }, [rows, search, statusFilter, from, to]);

  const routeName  = (id) => routesMap[String(id)] || '—';

  // Actions
  const openStart = (tripRow) => {
    // hydrate original trip to keep ids for API calls
    const t = trips.find(x => x._id === tripRow._id);
    setSelTrip(t || null);
    setStartKm('');
    setTotalizerStart('');
    setRouteId(String((t && t.routeId) || '') || '');
    setRemarks((t && t.remarks) || '');
    setStartOpen(true);
  };

  const openEnd = (tripRow) => {
    const t = trips.find(x => x._id === tripRow._id);
    setSelTrip(t || null);
    setEndKm('');
    setTotalizerEnd('');
    setEndOpen(true);
  };

  const closeModals = () => {
    if (saving) return;
    setStartOpen(false);
    setEndOpen(false);
    setSelTrip(null);
  };

  const onStartSubmit = async () => {
    if (!selTrip) return;
    if (!startKm || !totalizerStart || !routeId) {
      alert('route, start km and totalizer are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/trips/login', {
        tripId: selTrip._id,
        startKm: Number(startKm),
        totalizerStart: Number(totalizerStart),
        routeId,
        remarks
      });
      closeModals();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Failed to start trip.');
    } finally {
      setSaving(false);
    }
  };

  const onEndSubmit = async () => {
    if (!selTrip) return;
    if (!endKm || !totalizerEnd) {
      alert('end km and totalizer are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/trips/logout', {
        tripId: selTrip._id,
        endKm: Number(endKm),
        totalizerEnd: Number(totalizerEnd)
      });
      closeModals();
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Failed to close trip.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this trip?')) return;
    try {
      await api.delete(`/trips/${id}`);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Failed to delete trip.');
    }
  };

  const downloadInvoice = async (id) => {
    try {
      const res = await api.get(`/trips/${id}/invoice`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to download invoice.');
    }
  };

  const chip = (status) => {
    const base = 'inline-block text-xs px-2 py-1 rounded border';
    if (status === 'ACTIVE') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>ACTIVE</span>;
    if (status === 'ASSIGNED') return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>ASSIGNED</span>;
    return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>COMPLETED</span>;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Trip Listings</h2>
        <button
          onClick={fetchAll}
          className="ml-auto inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {err && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{err}</div>}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center border bg-white rounded px-2">
          <Search size={16} />
          <input
            placeholder="Search cust, product, vehicle, trip no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="Trip Status"
        >
          <option value="ALL">All Trip Status</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="To date"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-[1200px] w-full">
          <thead>
            <tr className="bg-yellow-300">
              <Th>Cust Id</Th>
              <Th>CustName</Th>
              <Th>ShipToLoc</Th>
              <Th>Pdt_Code</Th>
              <Th>Pdt_Name</Th>
              <Th>PdtQty</Th>
              <Th>UoM</Th>
              <Th>Date_Dely</Th>
              <Th>Time Slot</Th>
              <Th>Order Status</Th>
              <Th>Vehicle Allotted</Th>
              <Th className="text-center">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center" colSpan={12}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={12}>No trips found.</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <Td>{r.custId}</Td>
                  <Td>{r.custName}</Td>
                  <Td className="max-w-[280px] truncate" title={r.shipToLoc}>{r.shipToLoc}</Td>
                  <Td>{r.pdtCode}</Td>
                  <Td>{r.pdtName}</Td>
                  <Td>{r.pdtQty ?? '—'}</Td>
                  <Td>{r.uom}</Td>
                  <Td>{r.dateDely ? new Date(r.dateDely).toLocaleDateString() : '—'}</Td>
                  <Td>{r.timeSlot || '—'}</Td>
                  <Td>{r.orderStatus}</Td>
                  <Td>{r.vehicleAllotted}</Td>
                  <Td>
                    <div className="inline-flex items-center gap-2 justify-center">
                      {r.status === 'ASSIGNED' && (
                        <button
                          className="text-green-600 hover:text-green-800"
                          title="Start (login)"
                          onClick={() => openStart(r)}
                        >
                          <Play size={18} />
                        </button>
                      )}
                      {r.status === 'ACTIVE' && (
                        <button
                          className="text-yellow-700 hover:text-yellow-900"
                          title="Close (logout)"
                          onClick={() => openEnd(r)}
                        >
                          <Square size={18} />
                        </button>
                      )}
                      {r.status === 'COMPLETED' && (
                        <button
                          className="text-blue-600 hover:text-blue-800"
                          title="Download Invoice"
                          onClick={() => downloadInvoice(r._id)}
                        >
                          <FileText size={18} />
                        </button>
                      )}
                      <button
                        className="text-red-600 hover:text-red-800"
                        title="Delete Trip"
                        onClick={() => onDelete(r._id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="mt-1">{chip(r.status)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Trip: {r.tripNo}</div>
                    <div className="text-xs text-gray-500">Route: {routeName(r.routeId)}</div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Start (Login) Modal */}
      {startOpen && selTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : closeModals} />
          <div className="relative z-10 w-[95%] md:w-[720px] bg-white rounded shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">Start Trip — {selTrip.tripNo}</h3>
              <button className="p-1 rounded hover:bg-gray-100" onClick={closeModals} disabled={saving} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Readonly label="Vehicle" value={selTrip?.snapshot?.vehicleNo || '—'} />
              <Readonly label="Trip Status" value={selTrip.status} />
              <NumberField label="Start KM" value={startKm} onChange={setStartKm} required />
              <NumberField label="Totalizer Start" value={totalizerStart} onChange={setTotalizerStart} required />
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Route</label>
                <select
                  value={routeId}
                  onChange={e => setRouteId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">— Select route —</option>
                  {Object.entries(routesMap).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Remarks</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                      onClick={closeModals} disabled={saving}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      onClick={onStartSubmit} disabled={saving || !startKm || !totalizerStart || !routeId}>
                {saving ? 'Starting…' : 'Start Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End (Logout) Modal */}
      {endOpen && selTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : closeModals} />
          <div className="relative z-10 w-[95%] md:w-[620px] bg-white rounded shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">Close Trip — {selTrip.tripNo}</h3>
              <button className="p-1 rounded hover:bg-gray-100" onClick={closeModals} disabled={saving} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Readonly label="Vehicle" value={selTrip?.snapshot?.vehicleNo || '—'} />
              <Readonly label="Trip Status" value={selTrip.status} />
              <NumberField label="End KM" value={endKm} onChange={setEndKm} required />
              <NumberField label="Totalizer End" value={totalizerEnd} onChange={setTotalizerEnd} required />
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                      onClick={closeModals} disabled={saving}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
                      onClick={onEndSubmit} disabled={saving || !endKm || !totalizerEnd}>
                {saving ? 'Closing…' : 'Close Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- tiny building blocks ---------- */
function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold border border-black ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 border-t align-top ${className}`}>
      {children}
    </td>
  );
}
function Readonly({ label, value }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <div className="w-full border rounded px-3 py-2 bg-gray-100">{value || '—'}</div>
    </div>
  );
}
function NumberField({ label, value, onChange, required = false }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="number"
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        min="0"
      />
    </div>
  );
}
