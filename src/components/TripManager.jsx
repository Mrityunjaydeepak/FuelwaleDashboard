// src/components/TripManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { TruckIcon } from 'lucide-react';

/**
 * TripManager — table-first workflow (like your mock):
 * - Pick Route, Fleet, optional Capacity Override.
 * - Get a TABLE of pending orders: Ord_No, PartyCd, PartyName, Ord_Qty, Dely_Dt, Dely_Time, Assign/Remove.
 * - Select multiple orders; live total vs. capacity is shown.
 * - CONFIRM → creates the trip using the first selected order, then adds the rest (rides) sequentially.
 * - DISCARD → clears selection.
 * - After confirmation, you can Start / End trip like before; a capacity bar + planned list is shown.
 *
 * Notes:
 * - We assume each order’s full quantity is planned (no partial split UI).
 * - Backend endpoints used:
 *    POST /trips/assign
 *    POST /trips/:id/rides
 *    GET  /trips/:id/capacity
 *    POST /trips/login
 *    POST /trips/logout
 */

export default function TripManager() {
  // ── Lookups ─────────────────────────────────
  const [orders, setOrders]       = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [fleets, setFleets]       = useState([]);
  const [customers, setCustomers] = useState([]);
  const [allTrips, setAllTrips]   = useState([]);

  // ── Pre-assign selections ───────────────────
  const [assignRouteId,  setAssignRouteId]  = useState('');
  const [assignFleetId,  setAssignFleetId]  = useState('');
  const [capacityOverride, setCapacityOverride] = useState(''); // optional
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [tripNo, setTripNo] = useState('');

  // ── After assign ────────────────────────────
  const [tripId, setTripId] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState({ capacity: 0, plannedQty: 0, remainingQty: 0 });
  const [plannedOrders, setPlannedOrders] = useState([]);

  // ── Start / End state ───────────────────────
  const [started, setStarted] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [startKm, setStartKm] = useState('');
  const [totalizerStart, setTotalizerStart] = useState('');
  const [endKm, setEndKm] = useState('');
  const [totalizerEnd, setTotalizerEnd] = useState('');
  const [dieselOpening, setDieselOpening] = useState(null);

  // ── UI ──────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  // ── Fetch lookups ───────────────────────────
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

  // ── Helpers ─────────────────────────────────
  function normalizeFleet(fl) {
    const v = fl?.vehicle || {};
    const d = fl?.driver  || {};
    return {
      ...fl,
      vehicle: { vehicleNo: v.vehicleNo || '—', capacity: v.capacity ?? null, depotCd: v.depotCd ?? null, gpsYesNo: v.gpsYesNo ?? null },
      driver:  { driverName: d.driverName || d.name || '—', pesoLicenseNo: d.pesoLicenseNo || '' }
    };
  }
  const toNum = (v) => Number(v) || 0;

  // map order -> quantity (L)
  const orderQty = (ord) => (Array.isArray(ord?.items) ? ord.items : []).reduce((s, it) => s + toNum(it.quantity), 0);

  // lookup of customers (for party code)
  const custById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(String(c._id), c);
    return m;
  }, [customers]);

  // selected fleet
  const selectedFleet = useMemo(
    () => fleets.find(f => String(f._id) === String(assignFleetId)),
    [fleets, assignFleetId]
  );

  // effective capacity (override else vehicle capacity)
  const effectiveCapacity = useMemo(() => {
    if (String(capacityOverride).trim() !== '') return toNum(capacityOverride);
    return toNum(selectedFleet?.vehicle?.capacity);
  }, [capacityOverride, selectedFleet]);

  // filtered candidate orders
  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase();
    return orders
      .filter(o => o.orderStatus === 'PENDING')
      .filter(o =>
        String(o._id || '').includes(search) ||
        (o.customer?.custName?.toLowerCase() || '').includes(s) ||
        (custById.get(String(o.customer?._id || o.customer))?.custCd || '').toLowerCase().includes(s)
      );
  }, [orders, search, custById]);

  // selection derived values
  const selectedOrders = useMemo(
    () => filteredOrders.filter(o => selectedOrderIds.has(String(o._id))),
    [filteredOrders, selectedOrderIds]
  );
  const selectedTotalQty = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + orderQty(o), 0),
    [selectedOrders]
  );

  // trip number generation — SS DDD NNN based on first selected order’s customer
  useEffect(() => {
    const first = selectedOrders[0];
    if (!first) { setTripNo(''); return; }

    const extractSerial = (tn) => {
      const s = String(tn || ''); const m = s.match(/(\d{3})$/); return m ? parseInt(m[1], 10) : NaN;
    };
    (async () => {
      // customer details
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

  // capacity progress (post-assign)
  const progressPct = useMemo(() => {
    const cap = Number(capacityInfo.capacity) || 0;
    if (cap <= 0) return 0;
    const used = Math.min(cap, Number(capacityInfo.plannedQty) || 0);
    return Math.round((used / cap) * 100);
  }, [capacityInfo]);

  // ── Selection toggles ────────────────────────
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

  // ── Capacity check before confirm ────────────
  const canConfirm = !!assignRouteId && !!assignFleetId && !!selectedOrders.length && effectiveCapacity > 0 && selectedTotalQty <= effectiveCapacity;

  // ── API helpers ──────────────────────────────
  const refreshCapacity = async (tid) => {
    try {
      const r = await api.get(`/trips/${tid}/capacity`);
      setCapacityInfo(r.data || { capacity: 0, plannedQty: 0, remainingQty: 0 });
    } catch {}
  };

  // ── Confirm (create trip + add rides) ────────
  const handleConfirm = async () => {
    if (!canConfirm) {
      setError('Please select Route, Fleet, and valid orders within capacity.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [first, ...rest] = selectedOrders;
      const body = {
        tripNo,
        orderId: first._id,
        routeId: assignRouteId,
        fleetId: assignFleetId
      };
      if (String(capacityOverride).trim() !== '') {
        body.capacity = Number(capacityOverride);
      }
      // Create trip
      const res = await api.post('/trips/assign', body);
      const newTripId = res.data.tripId;
      setTripId(newTripId);
      setAssigned(true);
      setCapacityInfo(res.data.capacityInfo || { capacity: 0, plannedQty: 0, remainingQty: 0 });

      // add remaining rides sequentially
      for (const ord of rest) {
        await api.post(`/trips/${newTripId}/rides`, { orderId: ord._id });
      }
      await refreshCapacity(newTripId);

      // build planned list UI
      setPlannedOrders(
        selectedOrders.map(o => ({
          _id: o._id,
          name: o.customer?.custName || '—',
          qty: orderQty(o)
        }))
      );

      // lock selections
      setSelectedOrderIds(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm assignment');
    } finally {
      setLoading(false);
    }
  };

  // ── Discard selection ────────────────────────
  const handleDiscard = () => {
    clearSelection();
    setTripNo('');
  };

  // ── Start / End trip ─────────────────────────
  const handleStart = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const toN = (x) => Number(x);
    if (startKm === '' || totalizerStart === '' || !assignRouteId) {
      setError('Start KM, totalizer and route are required');
      setLoading(false);
      return;
    }
    if (toN(startKm) < 0 || toN(totalizerStart) < 0) {
      setError('Start KM and totalizer must be non-negative');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/trips/login', {
        tripId,
        startKm:        Number(startKm),
        totalizerStart: Number(totalizerStart),
        routeId:        assignRouteId,
        remarks
      });
      setDieselOpening(res.data.dieselOpening);
      setStarted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Start trip failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    setLoading(true);
    setError('');
    const toN = (x) => Number(x);
    if (endKm === '' || totalizerEnd === '') {
      setError('End KM and totalizer are required');
      setLoading(false);
      return;
    }
    if (toN(endKm) < toN(startKm)) { setError('End KM cannot be less than Start KM'); setLoading(false); return; }
    if (toN(totalizerEnd) < toN(totalizerStart)) { setError('Totalizer End cannot be less than Start'); setLoading(false); return; }

    try {
      await api.post('/trips/logout', { tripId, endKm: Number(endKm), totalizerEnd: Number(totalizerEnd) });
      // reset (keep filters optional)
      setAssigned(false); setStarted(false);
      setAssignRouteId(''); setAssignFleetId(''); setCapacityOverride('');
      setPlannedOrders([]); setCapacityInfo({ capacity: 0, plannedQty: 0, remainingQty: 0 });
      setTripId(''); setTripNo('');
      setStartKm(''); setTotalizerStart(''); setEndKm(''); setTotalizerEnd('');
      setRemarks(''); setDieselOpening(null);
    } catch (err) {
      setError(err.response?.data?.error || 'End trip failed');
    } finally {
      setLoading(false);
    }
  };

  // Format helpers
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
  const fmtTime = (t) => (t ? String(t).slice(0,5) : '—'); // HH:mm (best-effort)
  const fleetLabel = (f) => `${f?.vehicle?.vehicleNo || '—'} — ${f?.driver?.driverName || '—'}`;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <TruckIcon size={24}/> Trip Manager
      </h2>

      {error && <div className="text-red-600" aria-live="polite">{error}</div>}

      {/* ───────── PRE-ASSIGN AREA (TABLE) ───────── */}
      {!assigned && (
        <>
          {/* Header controls */}
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

            <div className="md:col-span-1">
              <label className="block font-semibold mb-1">Capacity Override (L) <span className="text-gray-500 font-normal">(optional)</span></label>
              <input
                type="number"
                min="0"
                value={capacityOverride}
                onChange={e => setCapacityOverride(e.target.value)}
                placeholder={selectedFleet?.vehicle?.capacity ? `Vehicle: ${selectedFleet.vehicle.capacity} L` : 'e.g. 5000'}
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block font-semibold mb-1">Trip No</label>
              <input
                value={tripNo}
                readOnly
                className="w-full bg-gray-100 border px-3 py-2 rounded"
                placeholder="Auto"
              />
            </div>
          </div>

          {/* Capacity summary */}
          <div className="p-3 bg-gray-50 rounded flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Effective Capacity: <strong>{effectiveCapacity || '—'}</strong> L
              <span className="ml-3">Selected Qty: <strong>{selectedTotalQty}</strong> L</span>
              <span className="ml-3">Remaining: <strong>{Math.max(0, (effectiveCapacity || 0) - selectedTotalQty)}</strong> L</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-50"
                title="Create trip & attach selected orders"
              >
                {loading ? 'Confirming…' : 'CONFIRM'}
              </button>
              <button
                onClick={handleDiscard}
                disabled={loading || selectedOrderIds.size === 0}
                className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
              >
                DISCARD
              </button>
            </div>
          </div>

          {/* Orders table */}
          <div className="bg-white border rounded overflow-x-auto">
            <div className="p-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID / Party Code / Name…"
                className="border rounded px-3 py-2 w-full md:w-80"
              />
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-yellow-200 text-gray-900">
                  <th className="px-3 py-2 text-left">Ord_No</th>
                  <th className="px-3 py-2 text-left">PartyCd</th>
                  <th className="px-3 py-2 text-left">PartyName</th>
                  <th className="px-3 py-2 text-right">Ord_Qty</th>
                  <th className="px-3 py-2 text-left">Dely_Dt</th>
                  <th className="px-3 py-2 text-left">Dely_Time</th>
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
                  const delyTm = o.deliveryTime || o.delyTime;

                  // If selecting this would exceed capacity, disable button (unless already selected)
                  const wouldExceed = !selected && effectiveCapacity > 0 && (selectedTotalQty + qty) > effectiveCapacity;

                  return (
                    <tr key={idStr} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">#{idStr.slice(-6)}</td>
                      <td className="px-3 py-2">{cust?.custCd || '—'}</td>
                      <td className="px-3 py-2">{cust?.custName || '—'}</td>
                      <td className="px-3 py-2 text-right">{qty}</td>
                      <td className="px-3 py-2">{fmtDate(delyDt)}</td>
                      <td className="px-3 py-2">{fmtTime(delyTm)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleSelect(o)}
                          disabled={wouldExceed}
                          className={`px-3 py-1 rounded text-white ${selected ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} ${wouldExceed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={selected ? 'Remove from selection' : (wouldExceed ? 'Exceeds capacity' : 'Add to selection')}
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
        </>
      )}

      {/* ───────── POST-ASSIGN: CAPACITY + START ───────── */}
      {assigned && !started && (
        <div className="space-y-5">
          {/* Capacity card */}
          <div className="p-4 bg-gray-50 rounded">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Capacity</div>
              <button
                type="button"
                onClick={() => refreshCapacity(tripId)}
                className="text-xs px-2 py-1 border rounded hover:bg-white"
              >
                Refresh
              </button>
            </div>
            <div className="text-sm mb-2">
              Planned: <strong>{capacityInfo.plannedQty}</strong> L / Capacity: <strong>{capacityInfo.capacity}</strong> L
              <span className="ml-2 text-gray-600">Remaining: <strong>{capacityInfo.remainingQty}</strong> L</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div className="h-2 bg-emerald-500 rounded" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Planned orders list */}
          <div className="p-4 bg-gray-50 rounded">
            <div className="font-semibold mb-2">Planned Orders</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1">#</th>
                  <th className="py-1">Customer</th>
                  <th className="py-1">Order ID</th>
                  <th className="py-1 text-right">Qty (L)</th>
                </tr>
              </thead>
              <tbody>
                {plannedOrders.map((p, idx) => (
                  <tr key={String(p._id)} className="border-t">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1">{p.name}</td>
                    <td className="py-1">#{String(p._id).slice(-6)}</td>
                    <td className="py-1 text-right">{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Start trip */}
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block font-semibold mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Start KM</label>
              <input
                type="number"
                value={startKm}
                onChange={e => setStartKm(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Totalizer Start</label>
              <input
                type="number"
                value={totalizerStart}
                onChange={e => setTotalizerStart(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !tripId}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Start Trip'}
            </button>
          </form>
        </div>
      )}

      {/* ───────── ACTIVE: END TRIP ───────── */}
      {assigned && started && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <p><strong>Diesel Opening:</strong> {dieselOpening ?? '—'} L</p>
            <div className="text-sm mt-2">
              Planned Qty: <strong>{capacityInfo.plannedQty}</strong> L • Trip Capacity: <strong>{capacityInfo.capacity}</strong> L
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">End KM</label>
            <input
              type="number"
              value={endKm}
              onChange={e => setEndKm(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Totalizer End</label>
            <input
              type="number"
              value={totalizerEnd}
              onChange={e => setTotalizerEnd(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            onClick={handleEnd}
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Ending…' : 'End Trip'}
          </button>
        </div>
      )}
    </div>
  );
}

// local utils
function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString() : '—'; } catch { return '—'; } }
function fmtTime(t) { if (!t) return '—'; const s = String(t); return s.length >= 5 ? s.slice(0,5) : s; }
