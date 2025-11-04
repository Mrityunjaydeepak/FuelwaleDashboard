// src/components/TripManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { TruckIcon, AlertTriangle } from 'lucide-react';

export default function TripManager() {
  // Lookups
  const [orders, setOrders]       = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [fleets, setFleets]       = useState([]);
  const [customers, setCustomers] = useState([]);
  const [allTrips, setAllTrips]   = useState([]);

  // Selections
  const [assignRouteId,  setAssignRouteId]  = useState('');
  const [assignFleetId,  setAssignFleetId]  = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [tripNo, setTripNo] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [warnText, setWarnText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Fleet detail fetch
  const [fleetDetail, setFleetDetail] = useState(null);

  // Hide orders we just assigned (instant UX)
  const [hiddenOrderIds, setHiddenOrderIds] = useState(new Set());

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers

  const toNum = (x) => (Number(x) || 0);

  function normalizeFleet(fl) {
    const v = fl?.vehicle || {};
    const d = fl?.driver  || {};
    const maxCap = toNum(v.capacityLtrs ?? v.capacity);
    const calCap = Number.isFinite(Number(v.calibratedCapacity)) ? Number(v.calibratedCapacity) : maxCap;
    return {
      ...fl,
      vehicle: {
        vehicleNo: v.vehicleNo || '—',
        capacityMax: maxCap,
        capacityCal: calCap,
        depotCd: v.depotCd ?? null,
        gpsYesNo: v.gpsYesNo ?? null
      },
      driver:  { driverName: d.driverName || d.name || '—', pesoLicenseNo: d.pesoLicenseNo || '' }
    };
  }

  async function refreshOrders() {
    try {
      const o = await api.get('/orders');
      setOrders(o.data || []);
    } catch {
      // ignore soft failures
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        const [o, r, f, c, t] = await Promise.all([
          api.get('/orders'),
          api.get('/routes'),
          api.get('/fleets'),
          api.get('/customers'),
          api.get('/trips').catch(() => ({ data: [] }))
        ]);
        setOrders(o.data || []);
        setRoutes(r.data || []);
        setFleets((f.data || []).map(normalizeFleet));
        setCustomers(c.data || []);
        const trips = (t.data || []).map(tr => ({ ...tr, tripNo: tr.tripNo ?? tr.tripNumber }));
        setAllTrips(trips);
      } catch {
        setError('Failed to load data');
      }
    })();
  }, []);

  // Light polling + focus refresh so orders assigned elsewhere disappear
  useEffect(() => {
    const id = setInterval(() => refreshOrders(), 8000);
    const onFocus = () => refreshOrders();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  // Refresh fleet detail when selection changes
  useEffect(() => {
    setFleetDetail(null);
    setWarnText('');
    if (!assignFleetId) return;
    (async () => {
      try {
        const res = await api.get(`/fleets/${assignFleetId}`);
        setFleetDetail(normalizeFleet(res.data));
      } catch {
        setFleetDetail(selectedFleet);
      }
    })();
  }, [assignFleetId]); // eslint-disable-line

  // Derived
  const orderQty = (ord) =>
    (Array.isArray(ord?.items) ? ord.items : []).reduce((s, it) => s + toNum(it.quantity), 0);

  const custById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(String(c._id), c);
    return m;
  }, [customers]);

  const selectedFleet = useMemo(
    () => fleets.find(f => String(f._id) === String(assignFleetId)),
    [fleets, assignFleetId]
  );

  const capacityMax = toNum((fleetDetail || selectedFleet)?.vehicle?.capacityMax);
  const capacityCal = toNum((fleetDetail || selectedFleet)?.vehicle?.capacityCal);
  const effectiveCapacity = capacityCal || capacityMax;

  function getOrderMetaNo(o) {
    const meta = o?.orderNoMeta || {};
    const state = (meta.stateCode || '').toString().padStart(2, '0');
    const depot = (meta.depotCode || '').toString().padStart(3, '0');
    const ddmmyy = (meta.ddmmyy || '').toString().padStart(6, '0');
    const run = meta.run != null ? String(meta.run).padStart(3, '0') : '';
    const composed = `${state}${depot}${ddmmyy}${run}`;
    if (/^\d{13,14}$/.test(composed)) return composed;
    if (o?.orderNo && /^\d{13}$/.test(String(o.orderNo))) return o.orderNo;
    return `#${String(o?._id || '').slice(-6)}`;
  }

  // Base: **only PENDING** + text filter (also match meta no)
  const baseFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return (orders || [])
      .filter(o => o.orderStatus === 'PENDING') // <- ONLY show pending
      .filter(o => {
        const metaNo = getOrderMetaNo(o);
        return (
          String(o._id || '').includes(search) ||
          (metaNo || '').toLowerCase().includes(s) ||
          (o.customer?.custName?.toLowerCase() || '').includes(s) ||
          (custById.get(String(o.customer?._id || o.customer))?.custCd || '').toLowerCase().includes(s)
        );
      });
  }, [orders, search, custById]);

  // EXCLUDE: orders with any allocation flags or ones we optimistically hid
  const filteredOrders = useMemo(() => {
    const hidden = hiddenOrderIds;
    return baseFiltered.filter(o => {
      const idStr = String(o._id || '');
      if (hidden.has(idStr)) return false;   // optimistic hide
      if (o.fleet) return false;
      if (o.vehicle) return false;
      if (o.allocatedAt) return false;
      if (o.tripId || o.trip) return false;
      return true;
    });
  }, [baseFiltered, hiddenOrderIds]);

  const selectedOrders = useMemo(
    () => filteredOrders.filter(o => selectedOrderIds.has(String(o._id))),
    [filteredOrders, selectedOrderIds]
  );

  const selectedTotalQty = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + orderQty(o), 0),
    [selectedOrders]
  );

  // Warn if any order individually exceeds calibrated capacity
  useEffect(() => {
    if (!effectiveCapacity) { setWarnText(''); return; }
    const offenders = filteredOrders.filter(o => orderQty(o) > effectiveCapacity).length;
    setWarnText(offenders ? `Note: ${offenders} order(s) individually exceed calibrated capacity (${effectiveCapacity} L) and cannot be assigned.` : '');
  }, [filteredOrders, effectiveCapacity]);

  // Trip No: derive prefix from first selected order & compute next suffix
  useEffect(() => {
    const first = selectedOrders[0];
    if (!first) { setTripNo(''); return; }

    const extractSerial = (tn) => {
      const s = String(tn || ''); const m = s.match(/(\d{3})$/); return m ? parseInt(m[1], 10) : NaN;
    };
    (async () => {
      const cid = typeof first.customer === 'object' ? first.customer._id : first.customer;
      const cust = customers.find(c => String(c._id) === String(cid));
      const stateCd = String(cust?.billStateCd || '').replace(/\D/g, '').slice(0, 2).padStart(2, '0');
      const depotCd = String(cust?.depotCd || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0');

      let freshTrips = [];
      try {
        const t = await api.get('/trips');
        freshTrips = (t.data || []).map(tr => ({ ...tr, tripNo: tr.tripNo ?? tr.tripNumber }));
      } catch {}
      const merged = [...freshTrips, ...allTrips].filter(Boolean);
      const dedup = new Map();
      for (const tr of merged) if (tr?.tripNo && !dedup.has(tr.tripNo)) dedup.set(tr.tripNo, tr);
      const trips = Array.from(dedup.values());
      const suffixes = trips.map(t => extractSerial(t.tripNo)).filter(Number.isFinite);
      const next = suffixes.length ? (Math.max(...suffixes) + 1) % 1000 : 0;
      const nnn  = String(next).padStart(3, '0');
      setTripNo(`${stateCd}${depotCd}${nnn}`);
      setAllTrips(trips);
    })();
  }, [selectedOrders, customers, allTrips]);

  // Selection toggles
  const toggleSelect = (order) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      const id = String(order._id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedOrderIds(new Set());

  // Guards
  const canConfirm =
    !!assignRouteId &&
    !!assignFleetId &&
    !!selectedOrders.length &&
    effectiveCapacity > 0 &&
    selectedTotalQty <= effectiveCapacity &&
    Math.min(...selectedOrders.map(o => orderQty(o))) <= effectiveCapacity;

  // --- Helper: mark orders ASSIGNED on server (fallback to local optimistic) ---
  async function markOrdersAssigned(orderIds) {
    // If your API uses a different route, adjust this call:
    // e.g. await api.put(`/orders/${id}`, { orderStatus: 'ASSIGNED' })
    await Promise.allSettled(
      orderIds.map(id => api.patch(`/orders/${id}/status`, { orderStatus: 'ASSIGNED' }))
    );
  }

  // Confirm: create trip & push orders; mark them ASSIGNED; then reset and stay in the list view
  const handleConfirm = async () => {
    if (!canConfirm) {
      setError('Please select Route, Fleet, and keep quantities within calibrated capacity.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sorted = [...selectedOrders].sort((a, b) => orderQty(a) - orderQty(b));
      const [first, ...rest] = sorted;

      const body = { tripNo, orderId: first._id, routeId: assignRouteId, fleetId: assignFleetId };
      const res = await api.post('/trips/assign', body);
      const newTripId = res.data.tripId;

      // Add remaining orders to that trip
      for (const ord of rest) {
        await api.post(`/trips/${newTripId}/rides`, { orderId: ord._id });
      }

      // Mark them ASSIGNED on the server (best-effort)
      const assignedIdsArr = sorted.map(o => String(o._id));
      await markOrdersAssigned(assignedIdsArr);

      // Optimistically hide + set orderStatus locally so they vanish from PENDING list
      const assignedIds = new Set(assignedIdsArr);
      setOrders(prev =>
        prev
          .map(o => (assignedIds.has(String(o._id)) ? { ...o, orderStatus: 'ASSIGNED' } : o))
          .filter(o => o.orderStatus === 'PENDING') // keep only pending in state too
      );
      setHiddenOrderIds(prev => {
        const next = new Set(prev);
        for (const id of assignedIds) next.add(id);
        return next;
      });

      // Pull latest from server too (keeps in sync if other fields changed)
      await refreshOrders();

      // Success banner
      setSuccessText(`Trip ${tripNo} created with ${sorted.length} order(s). Orders marked ASSIGNED.`);
      setTimeout(() => setSuccessText(''), 4000);

      // Reset selection & inputs
      clearSelection();
      setAssignRouteId('');
      setAssignFleetId('');
      setTripNo('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm assignment');
    } finally {
      setLoading(false);
    }
  };

  const fleetLabel = (f) => `${f?.vehicle?.vehicleNo || '—'} — ${f?.driver?.driverName || '—'}`;

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <TruckIcon size={24}/> Trip Manager
      </h2>

      {error && <div className="text-red-600" aria-live="polite">{error}</div>}
      {successText && (
        <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {successText}
        </div>
      )}

      {/* ASSIGN */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <label className="block font-semibold mb-1">Route</label>
          <select
            value={assignRouteId}
            onChange={e => setAssignRouteId(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">— Select Route —</option>
            {routes.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold mb-1">Fleet (Vehicle + Driver)</label>
          <select
            value={assignFleetId}
            onChange={e => setAssignFleetId(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">— Select Fleet —</option>
            {fleets.map(f => <option key={f._id} value={f._id}>{fleetLabel(f)}</option>)}
          </select>
        </div>

        {/* Read-only capacities */}
        <div className="md:col-span-1">
          <label className="block font-semibold mb-1">Vehicle Capacity (Max, L)</label>
          <input
            value={capacityMax || ''}
            readOnly
            className="w-full bg-gray-100 border px-3 py-2 rounded"
            placeholder="—"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block font-semibold mb-1">Calibrated Capacity (L)</label>
          <input
            value={capacityCal || ''}
            readOnly
            className="w-full bg-gray-100 border px-3 py-2 rounded"
            placeholder="—"
          />
        </div>
      </div>

      {/* Capacity summary + actions */}
      <div className="p-3 bg-gray-50 rounded space-y-2">
        <div className="text-sm">
          Calibrated Capacity: <strong>{effectiveCapacity || '—'}</strong> L
          <span className="ml-3">Selected Qty: <strong>{selectedTotalQty}</strong> L</span>
          <span className="ml-3">Remaining: <strong>{Math.max(0, (effectiveCapacity || 0) - selectedTotalQty)}</strong> L</span>
        </div>
        {!!warnText && (
          <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs inline-flex items-center gap-2">
            <AlertTriangle size={14} /> {warnText}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={refreshOrders}
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            title="Pull latest orders"
          >
            Refresh Orders
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Confirming…' : 'CONFIRM & CREATE TRIP'}
          </button>
          <button
            onClick={() => { clearSelection(); setTripNo(''); }}
            disabled={loading || selectedOrderIds.size === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
          >
            DISCARD
          </button>
        </div>
      </div>

      {/* Orders table (ONLY PENDING) */}
      <div className="bg-white border rounded overflow-x-auto">
        <div className="p-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Meta No / ID / Party Code / Name…"
            className="border rounded px-3 py-2 w-full md:w-80"
          />
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-yellow-200 text-gray-900">
              <th className="px-3 py-2 text-left">Meta_No</th>
              <th className="px-3 py-2 text-left">PartyCd</th>
              <th className="px-3 py-2 text-left">PartyName</th>
              <th className="px-3 py-2 text-right">Ord_Qty</th>
              <th className="px-3 py-2 text-left">Dely_Dt</th>
              <th className="px-3 py-2 text-left">Dely_Slot</th>
              <th className="px-3 py-2 text-center">Assign/remove</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => {
              const idStr = String(o._id);
              const selected = selectedOrderIds.has(idStr);
              const custId = typeof o.customer === 'object' ? o.customer._id : o.customer;
              const cust   = custById.get(String(custId)) || o.customer || {};
              const qty    = orderQty(o);
              const delyDt = o.deliveryDate || o.delyDt;

              const delySlot = o.deliveryTimeSlot || o.deliveryTime || o.delyTime || '—';
              const metaNo = getOrderMetaNo(o);

              const exceedsSelf = effectiveCapacity > 0 && qty > effectiveCapacity;
              const wouldExceed = !selected && effectiveCapacity > 0 && (selectedTotalQty + qty) > effectiveCapacity;

              return (
                <tr key={idStr} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{metaNo}</td>
                  <td className="px-3 py-2">{cust?.custCd || '—'}</td>
                  <td className="px-3 py-2">{cust?.custName || '—'}</td>
                  <td className="px-3 py-2 text-right">{qty}</td>
                  <td className="px-3 py-2">{fmtDate(delyDt)}</td>
                  <td className="px-3 py-2">{delySlot}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleSelect(o)}
                      disabled={exceedsSelf || wouldExceed}
                      className={`px-3 py-1 rounded text-white ${selected ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} ${(exceedsSelf || wouldExceed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={
                        selected
                          ? 'Remove from selection'
                          : exceedsSelf
                          ? 'Order qty exceeds calibrated capacity'
                          : wouldExceed
                          ? 'Adding this would exceed remaining capacity'
                          : 'Add to selection'
                      }
                    >
                      {selected ? 'Remove' : 'Assign'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filteredOrders.length && (
              <tr><td colSpan="7" className="px-3 py-6 text-center text-gray-500">No pending orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// utils
function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString() : '—'; } catch { return '—'; } }
