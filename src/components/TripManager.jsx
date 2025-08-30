// src/components/TripManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { TruckIcon } from 'lucide-react';

export default function TripManager() {
  // ── Master data ─────────────────────────────
  const [orders, setOrders]       = useState([]);
  const [customers, setCustomers] = useState([]);
  const [fleets, setFleets]       = useState([]);     // NEW: fleets (vehicle + driver)
  const [routes, setRoutes]       = useState([]);
  const [allTrips, setAllTrips]   = useState([]);

  // ── Selection state ──────────────────────────
  const [assignOrderId,  setAssignOrderId]  = useState('');
  const [selectedOrder,  setSelectedOrder]  = useState(null);
  const [tripNo,         setTripNo]         = useState('');
  const [assignRouteId,  setAssignRouteId]  = useState('');
  const [assignFleetId,  setAssignFleetId]  = useState(''); // NEW: select one Fleet
  const [sendCapacity,   setSendCapacity]   = useState('');

  // ── Workflow flags ───────────────────────────
  const [assigned, setAssigned] = useState(false);
  const [started,  setStarted]  = useState(false);

  // ── Start‐trip form state ────────────────────
  const [remarks,        setRemarks]        = useState('');
  const [startKm,        setStartKm]        = useState('');
  const [totalizerStart, setTotalizerStart] = useState('');

  // ── End‐trip form state ──────────────────────
  const [endKm,        setEndKm]        = useState('');
  const [totalizerEnd, setTotalizerEnd] = useState('');

  // ── Active trip data ────────────────────────
  const [tripId,         setTripId]         = useState('');
  const [dieselOpening,  setDieselOpening]  = useState(null);
  const [deliveries,     setDeliveries]     = useState([]);

  // ── Delivery count ──────────────────────────
  const [createdDeliveriesCount, setCreatedDeliveriesCount] = useState(0);

  // ── UI ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');

  const toNum = v => Number(v) || 0;

  // helper: extract the last 3 digits (serial NNN)
  const extractSerial = (tn) => {
    const s = String(tn || '');
    const m = s.match(/(\d{3})$/); // only the final 3 digits
    return m ? parseInt(m[1], 10) : NaN;
  };

  // ── 1) Fetch lookups (incl. customers) & normalize trips ──
  useEffect(() => {
    (async () => {
      try {
        const [o, c, f, r, t] = await Promise.all([
          api.get('/orders'),
          api.get('/customers'),
          api.get('/fleets'),                 // NEW: fetch fleets (expect vehicle+driver populated if possible)
          api.get('/routes'),
          api.get('/trips').catch(() => ({ data: [] })) // non-fatal
        ]);
        setOrders(o.data || []);
        setCustomers(c.data || []);
        setFleets((f.data || []).map(x => normalizeFleet(x)));
        setRoutes(r.data || []);

        const trips = (t.data || []).map(tr => ({
          ...tr,
          tripNo: tr.tripNo ?? tr.tripNumber
        }));
        setAllTrips(trips);
      } catch {
        setError('Failed to load one or more lookups');
      }
    })();
  }, []);

  // Normalize a fleet record (defensive if API isn’t populated)
  const normalizeFleet = (fl) => {
    const v = fl?.vehicle || {};
    const d = fl?.driver  || {};
    return {
      ...fl,
      vehicle: {
        ...v,
        vehicleNo: v.vehicleNo || fl?.vehicleNo || '—',
        capacity:  v.capacity ?? null,
        depotCd:   v.depotCd ?? fl?.depotCd ?? null,
      },
      driver: {
        ...d,
        driverName: d.driverName || d.name || fl?.driverName || '—',
        pesoLicenseNo: d.pesoLicenseNo || fl?.pesoLicenseNo || '',
      }
    };
  };

  // ── 2) When order changes: select & prefill capacity ───
  useEffect(() => {
    if (!assignOrderId) {
      setSelectedOrder(null);
      setSendCapacity('');
      return;
    }
    const ord = orders.find(o => String(o._id) === String(assignOrderId)) || null;
    setSelectedOrder(ord);

    const items = Array.isArray(ord?.items) ? ord.items : [];
    const totalQty = items.reduce((sum, i) => sum + toNum(i.quantity), 0);
    setSendCapacity(totalQty);
  }, [assignOrderId, orders]);

  // ── 3) Generate tripNo (SS + DDD + NNN) — NNN is always 3 digits ──────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!assignOrderId) { setTripNo(''); return; }

      const ord = orders.find(o => String(o._id) === String(assignOrderId));
      if (!ord?.customer) { setTripNo(''); return; }

      // full customer (orders may have only partial)
      const custIdFromOrder =
        (typeof ord.customer === 'object' ? ord.customer._id : ord.customer) || '';
      const fullCust = customers.find(c => String(c._id) === String(custIdFromOrder));

      // SS: billStateCd digits (fallback "00")
      const stateRaw = fullCust?.billStateCd ?? '';
      const stateCd  = String(stateRaw).replace(/\D/g, '').slice(0, 2).padStart(2, '0');

      // DDD: depot digits (fallback "000")
      const depotRaw = (ord.customer?.depotCd ?? fullCust?.depotCd ?? '');
      const depotCd  = String(depotRaw).replace(/\D/g, '').slice(0, 3).padStart(3, '0');

      // refresh trips for latest serials
      let freshTrips = [];
      try {
        const t = await api.get('/trips');
        freshTrips = (t.data || []).map(tr => ({ ...tr, tripNo: tr.tripNo ?? tr.tripNumber }));
      } catch {
        // ignore; use cached
      }

      // merge + dedup by tripNo
      const merged = [...freshTrips, ...allTrips].filter(Boolean);
      const dedup = new Map();
      for (const tr of merged) if (tr?.tripNo && !dedup.has(tr.tripNo)) dedup.set(tr.tripNo, tr);
      const trips = Array.from(dedup.values());

      // Next serial = (max last-3-digits) + 1; start at 000; wrap at 1000
      const suffixes = trips.map(t => extractSerial(t.tripNo)).filter(Number.isFinite);
      const next = suffixes.length ? (Math.max(...suffixes) + 1) % 1000 : 0;
      const nnn = String(next).padStart(3, '0');

      if (!cancelled) {
        setTripNo(`${stateCd}${depotCd}${nnn}`);
        setAllTrips(trips);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [assignOrderId, orders, customers]); // (not including allTrips to avoid loop)

  // ── Helpers ───────────────────────────────────
  const orderItems = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];

  // Basic label for a fleet option
  const fleetLabel = (f) => {
    const vno = f?.vehicle?.vehicleNo || '—';
    const dnm = f?.driver?.driverName || '—';
    return `${vno} — ${dnm}`;
  };

  // ── 4) Assign Trip (now with fleetId) ─────────────────────
  const handleAssign = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!assignOrderId || !assignRouteId || !assignFleetId || !sendCapacity) {
      setError('Trip No, Order, Route, Fleet and Capacity are required');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/trips/assign', {
        tripNo,                         // server will save exactly this
        orderId:   assignOrderId,
        routeId:   assignRouteId,
        fleetId:   assignFleetId,       // NEW
        capacity:  Number(sendCapacity),
      });
      const { tripId: newTripId, tripNo: newTripNo, seededDeliveriesCount } = res.data;

      setTripId(newTripId);
      setTripNo(newTripNo);
      setAssigned(true);
      setCreatedDeliveriesCount(seededDeliveriesCount);

      // cache tripNo so the next serial moves forward
      setAllTrips(prev => {
        const list = [{ tripNo: newTripNo }, ...prev];
        const m = new Map();
        for (const tr of list) if (tr?.tripNo && !m.has(tr.tripNo)) m.set(tr.tripNo, tr);
        return Array.from(m.values());
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  // ── 5) Start Trip (no driverId/vehicleNo needed now) ──────
  const handleStart = async e => {
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
        startKm:         Number(startKm),
        totalizerStart:  Number(totalizerStart),
        routeId:         assignRouteId,
        remarks
      });
      setDieselOpening(res.data.dieselOpening);
      setDeliveries(res.data.deliveries || []); // may be empty
      setStarted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Start trip failed');
    } finally {
      setLoading(false);
    }
  };

  // ── 6) End Trip ────────────────────────────────
  const handleEnd = async () => {
    setLoading(true);
    setError('');

    const toN = (x) => Number(x);
    if (endKm === '' || totalizerEnd === '') {
      setError('End KM and totalizer are required');
      setLoading(false);
      return;
    }
    if (toN(endKm) < toN(startKm)) {
      setError('End KM cannot be less than Start KM');
      setLoading(false);
      return;
    }
    if (toN(totalizerEnd) < toN(totalizerStart)) {
      setError('Totalizer End cannot be less than Start');
      setLoading(false);
      return;
    }

    try {
      await api.post('/trips/logout', {
        tripId,
        endKm:        Number(endKm),
        totalizerEnd: Number(totalizerEnd),
      });
      // reset most state but keep search text
      setAssigned(false);
      setStarted(false);
      setAssignOrderId('');
      setAssignRouteId('');
      setAssignFleetId('');
      setSendCapacity('');
      setRemarks('');
      setStartKm('');
      setTotalizerStart('');
      setEndKm('');
      setTotalizerEnd('');
      setTripId('');
      setDieselOpening(null);
      setDeliveries([]);
      setCreatedDeliveriesCount(0);
    } catch (err) {
      setError(err.response?.data?.error || 'End trip failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Filter orders for search ───────────────────
  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase();
    return orders.filter(o =>
      String(o._id || '').includes(search) ||
      (o.customer?.custName?.toLowerCase() || '').includes(s)
    );
  }, [orders, search]);

  // Find selected fleet for display
  const selectedFleet = useMemo(
    () => fleets.find(f => String(f._id) === String(assignFleetId)),
    [fleets, assignFleetId]
  );

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <TruckIcon size={24}/> Trip Manager
      </h2>
      {error && <div className="text-red-600" aria-live="polite">{error}</div>}

      {/* 1) ASSIGN */}
      {!assigned && (
        <form onSubmit={handleAssign} className="space-y-4">
          {/* Trip No */}
          <div>
            <label className="block font-semibold mb-1" htmlFor="tripNo">Trip No</label>
            <input
              id="tripNo"
              readOnly
              value={tripNo}
              className="w-full bg-gray-100 border px-3 py-2 rounded"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: SS DDD NNN (State[Billing] + Depot + 3-digit Serial)
            </p>
          </div>

          {/* Order */}
          <div>
            <label className="block font-semibold mb-1" htmlFor="orderSearch">Order</label>
            <input
              id="orderSearch"
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-1"
            />
            <select
              value={assignOrderId}
              onChange={e => setAssignOrderId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">— Select Order —</option>
              {filteredOrders.map(o => (
                <option key={o._id} value={o._id}>
                  {o.customer?.custName} — #{String(o._id).slice(-6)}
                </option>
              ))}
            </select>
          </div>

          {/* Order summary */}
          {selectedOrder && (
            <div className="p-3 bg-gray-50 rounded space-y-1">
              <p><strong>Ship To:</strong> {selectedOrder.shipToAddress}</p>
              <p>
                <strong>Order Qty:</strong>{' '}
                {orderItems.reduce((sum, i) => sum + toNum(i.quantity), 0)} L
              </p>
            </div>
          )}

          {/* Route */}
          <div>
            <label className="block font-semibold mb-1">Route</label>
            <select
              value={assignRouteId}
              onChange={e => setAssignRouteId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">— Select Route —</option>
              {routes.map(r => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Fleet (Vehicle + Driver) */}
          <div>
            <label className="block font-semibold mb-1">Fleet (Vehicle + Driver)</label>
            <select
              value={assignFleetId}
              onChange={e => setAssignFleetId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">— Select Fleet —</option>
              {fleets.map(f => (
                <option key={f._id} value={f._id}>
                  {fleetLabel(f)}
                </option>
              ))}
            </select>
            {selectedFleet && (
              <p className="text-xs text-gray-600 mt-1">
                Depot: {selectedFleet.vehicle?.depotCd || '—'} • Capacity: {selectedFleet.vehicle?.capacity ?? '—'} L • GPS: {String(selectedFleet.gpsYesNo ?? selectedFleet.vehicle?.gpsYesNo ?? '—')}
              </p>
            )}
          </div>

          {/* Load to Send */}
          <div>
            <label className="block font-semibold mb-1">Load to Send (L)</label>
            <input
              type="number"
              min="0"
              value={sendCapacity}
              onChange={e => setSendCapacity(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Assigning…' : 'Assign Trip'}
          </button>
        </form>
      )}

      {/* 2) START */}
      {assigned && !started && (
        <form onSubmit={handleStart} className="space-y-4">
          {selectedFleet && (
            <div className="p-3 bg-gray-50 rounded">
              <p>
                <strong>Vehicle:</strong> {selectedFleet.vehicle?.vehicleNo || '—'}
              </p>
              <p>
                <strong>Driver:</strong> {selectedFleet.driver?.driverName || '—'}
                {selectedFleet.driver?.pesoLicenseNo ? ` — ${selectedFleet.driver.pesoLicenseNo}` : ''}
              </p>
              {createdDeliveriesCount > 0 && (
                <p className="text-sm text-emerald-700 mt-1">
                  Seeded {createdDeliveriesCount} deliveries.
                </p>
              )}
            </div>
          )}

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
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting…' : 'Start Trip'}
          </button>
        </form>
      )}

      {/* 3) END */}
      {assigned && started && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <p><strong>Diesel Opening:</strong> {dieselOpening ?? '—'} L</p>
            {selectedFleet && (
              <p className="text-sm text-gray-600">
                Vehicle {selectedFleet.vehicle?.vehicleNo || '—'} • Driver {selectedFleet.driver?.driverName || '—'}
              </p>
            )}
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
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ending…' : 'End Trip'}
          </button>
        </div>
      )}
    </div>
  );
}
