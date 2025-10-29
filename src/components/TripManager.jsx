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

  // After assign
  const [tripId, setTripId] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState({ capacity: 0, plannedQty: 0, remainingQty: 0 });
  const [plannedOrders, setPlannedOrders] = useState([]);

  // Start / End
  const [started, setStarted] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [startKm, setStartKm] = useState('');
  const [totalizerStart, setTotalizerStart] = useState('');
  const [endKm, setEndKm] = useState('');
  const [totalizerEnd, setTotalizerEnd] = useState('');
  const [dieselOpening, setDieselOpening] = useState(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [warnText, setWarnText] = useState('');

  // Fleet detail fetch
  const [fleetDetail, setFleetDetail] = useState(null);

  // Hide orders we just assigned (instant UX)
  const [hiddenOrderIds, setHiddenOrderIds] = useState(new Set());

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

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers / derived

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
  const toNum = (x) => (Number(x) || 0);

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

  // Prefer freshly fetched fleet detail → else list snapshot
  const capacityMax = toNum((fleetDetail || selectedFleet)?.vehicle?.capacityMax);
  const capacityCal = toNum((fleetDetail || selectedFleet)?.vehicle?.capacityCal);
  const effectiveCapacity = capacityCal || capacityMax;

  // Build the "Meta No" from order.orderNoMeta (fallbacks included)
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

  // Base pending + text filter (also match meta no)
  const baseFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return (orders || [])
      // Only pending AND explicitly exclude any "ASSIGNED" that might slip through
      .filter(o => o.orderStatus === 'PENDING' && o.orderStatus !== 'ASSIGNED')
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

  // EXCLUDE: orders we just assigned now, or with allocation flags
  const filteredOrders = useMemo(() => {
    const hidden = hiddenOrderIds;
    return baseFiltered.filter(o => {
      const idStr = String(o._id || '');
      if (hidden.has(idStr)) return false;
      if (o.fleet) return false;
      if (o.vehicle) return false;
      if (o.allocatedAt) return false;
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

  // Trip No: derive prefix from first selected order
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

  const progressPct = useMemo(() => {
    const cap = Number(capacityInfo.capacity) || 0;
    if (cap <= 0) return 0;
    const used = Math.min(cap, Number(capacityInfo.plannedQty) || 0);
    return Math.round((used / cap) * 100);
  }, [capacityInfo]);

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

  const refreshCapacity = async (tid) => {
    try {
      const r = await api.get(`/trips/${tid}/capacity`);
      setCapacityInfo(r.data || { capacity: 0, plannedQty: 0, remainingQty: 0 });
    } catch {}
  };

  // Confirm: smallest order first; hide assigned from list
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

      const body = {
        tripNo,
        orderId: first._id,
        routeId: assignRouteId,
        fleetId: assignFleetId
      };

      const res = await api.post('/trips/assign', body);
      const newTripId = res.data.tripId;
      setTripId(newTripId);
      setAssigned(true);
      setCapacityInfo(res.data.capacityInfo || { capacity: 0, plannedQty: 0, remainingQty: 0 });

      for (const ord of rest) {
        await api.post(`/trips/${newTripId}/rides`, { orderId: ord._id });
      }
      await refreshCapacity(newTripId);

      // Planned list UI
      setPlannedOrders(
        sorted.map(o => ({ _id: o._id, name: o.customer?.custName || '—', qty: orderQty(o) }))
      );

      // Hide assigned orders immediately
      const assignedIds = new Set(sorted.map(o => String(o._id)));
      setHiddenOrderIds(prev => {
        const next = new Set(prev);
        for (const id of assignedIds) next.add(id);
        return next;
      });
      setOrders(prev => prev.filter(o => !assignedIds.has(String(o._id))));
      setSelectedOrderIds(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm assignment');
    } finally {
      setLoading(false);
    }
  };

  // Discard
  const handleDiscard = () => {
    clearSelection();
    setTripNo('');
  };

  // Start / End
  const handleStart = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const n = (x) => Number(x);
    if (startKm === '' || totalizerStart === '' || !assignRouteId) {
      setError('Start KM, totalizer and route are required');
      setLoading(false);
      return;
    }
    if (n(startKm) < 0 || n(totalizerStart) < 0) {
      setError('Start KM and totalizer must be non-negative');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/trips/login', {
        tripId,
        startKm: n(startKm),
        totalizerStart: n(totalizerStart),
        routeId: assignRouteId,
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
    const n = (x) => Number(x);
    if (endKm === '' || totalizerEnd === '') {
      setError('End KM and totalizer are required');
      setLoading(false);
      return;
    }
    if (n(endKm) < n(startKm)) { setError('End KM cannot be less than Start KM'); setLoading(false); return; }
    if (n(totalizerEnd) < n(totalizerStart)) { setError('Totalizer End cannot be less than Start'); setLoading(false); return; }

    try {
      await api.post('/trips/logout', { tripId, endKm: n(endKm), totalizerEnd: n(totalizerEnd) });
      // reset
      setAssigned(false); setStarted(false);
      setAssignRouteId(''); setAssignFleetId('');
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

  const fleetLabel = (f) => `${f?.vehicle?.vehicleNo || '—'} — ${f?.driver?.driverName || '—'}`;

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <TruckIcon size={24}/> Trip Manager
      </h2>

      {error && <div className="text-red-600" aria-live="polite">{error}</div>}

      {/* PRE-ASSIGN */}
      {!assigned && (
        <>
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

          {/* Capacity summary */}
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
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-50"
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

                  // Use deliveryTimeSlot primarily, fallback to older fields if present
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
        </>
      )}

      {/* POST-ASSIGN (before Start) */}
      {assigned && !started && (
        <div className="space-y-5">
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

          <div className="p-4 bg-gray-50 rounded">
            <div className="font-semibold mb-2">Planned Orders</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1">#</th>
                  <th className="py-1">Customer</th>
                  <th className="py-1">Meta No</th>
                  <th className="py-1 text-right">Qty (L)</th>
                </tr>
              </thead>
              <tbody>
                {plannedOrders.map((p, idx) => (
                  <tr key={String(p._id)} className="border-t">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1">{p.name}</td>
                    <td className="py-1">{getOrderMetaNo(orders.find(x => String(x._id) === String(p._id)) || {})}</td>
                    <td className="py-1 text-right">{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

      {/* ACTIVE: END TRIP */}
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

// utils
function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString() : '—'; } catch { return '—'; } }
