import React, { useState, useEffect } from 'react';
import api from '../api';
import { TruckIcon } from 'lucide-react';

export default function TripManager() {
  // ── Master data ─────────────────────────────
  const [orders, setOrders]     = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes]     = useState([]);
  const [allTrips, setAllTrips] = useState([]);

  // ── Selection state ──────────────────────────
  const [assignOrderId, setAssignOrderId]     = useState('');
  const [selectedOrder, setSelectedOrder]     = useState(null);
  const [tripNo, setTripNo]                   = useState('');
  const [assignRouteId, setAssignRouteId]     = useState('');
  const [assignVehicleNo, setAssignVehicleNo] = useState('');
  const [assignDriverId, setAssignDriverId]   = useState('');
  const [sendCapacity, setSendCapacity]       = useState('');

  // ── Workflow flags ──────────────────────────
  const [assigned, setAssigned] = useState(false);
  const [started, setStarted]   = useState(false);

  // ── Start‐trip form state ───────────────────
  const [remarks, setRemarks]               = useState('');
  const [startKm, setStartKm]               = useState('');
  const [totalizerStart, setTotalizerStart] = useState('');

  // ── End‐trip form state ─────────────────────
  const [endKm, setEndKm]                   = useState('');
  const [totalizerEnd, setTotalizerEnd]     = useState('');

  // ── Active trip data ───────────────────────
  const [tripId, setTripId]               = useState('');
  const [dieselOpening, setDieselOpening] = useState(null);
  const [deliveries, setDeliveries]       = useState([]);

  // ── Delivery count ──────────────────────────
  const [createdDeliveriesCount, setCreatedDeliveriesCount] = useState(0);

  // ── UI ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  // Fetch lookups & existing trips
  useEffect(() => {
    api.get('/orders').then(r => setOrders(r.data)).catch(() => setError('Failed to load orders'));
    api.get('/drivers').then(r => setDrivers(r.data)).catch(() => setError('Failed to load drivers'));
    api.get('/vehicles').then(r => setVehicles(r.data)).catch(() => setError('Failed to load vehicles'));
    api.get('/routes').then(r => setRoutes(r.data)).catch(() => setError('Failed to load routes'));
    api.get('/trips').then(r => setAllTrips(r.data)).catch(() => {});
  }, []);

  // When order changes, select it and generate tripNo
  useEffect(() => {
    if (!assignOrderId) {
      setSelectedOrder(null);
      setTripNo('');
      return;
    }
    const ord = orders.find(o => o._id === assignOrderId);
    setSelectedOrder(ord || null);

    // State code: first 2 chars of customer.stateCd
    const rawState = ord?.customer?.stateCd || '';
    const stateCd = rawState.slice(0, 2).padStart(2, '0');

    // Depot code: customer.depotCd, 3 digits
    const rawDepot = ord?.customer?.depotCd || '';
    const depotCd = rawDepot.padStart(3, '0');

    const prefix = `${stateCd}${depotCd}`;

    // Count existing trips with this prefix
    const used = allTrips.filter(t => t.tripNo?.startsWith(prefix)).length;

    // Running number starts at "000"
    const seq = String(used).padStart(3, '0');

    setTripNo(prefix + seq);
  }, [assignOrderId, orders, allTrips]);

  // Vehicles on selected route
  const vehiclesOnRoute = vehicles.filter(v => v.route?._id === assignRouteId);

  // Details for chosen vehicle
  const selectedVehicle = vehicles.find(v => v.vehicleNo === assignVehicleNo);

  // Safe order items
  const orderItems = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];

  // ── 1) Assign Trip ────────────────────────────
  const handleAssign = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!assignOrderId || !assignRouteId || !assignVehicleNo || !assignDriverId || !sendCapacity) {
      setError('All fields are required');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/trips/assign', {
        tripNo,
        orderId:   assignOrderId,
        routeId:   assignRouteId,
        vehicleNo: assignVehicleNo,  // keep vehicleNo
        driverId:  assignDriverId,
        capacity:  Number(sendCapacity)
      });
      setTripId(res.data.tripId);
      setAssigned(true);
      setCreatedDeliveriesCount(res.data.seededDeliveriesCount || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  // ── 2) Start Trip ─────────────────────────────
  const handleStart = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!startKm || !totalizerStart) {
      setError('Start KM and totalizer are required');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/trips/login', {
        tripId,
        driverId:        assignDriverId,
        remarks,
        startKm:        Number(startKm),
        totalizerStart: Number(totalizerStart)
      });
      setDieselOpening(res.data.dieselOpening);
      setDeliveries(res.data.deliveries);
      setStarted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Start trip failed');
    } finally {
      setLoading(false);
    }
  };

  // ── 3) End Trip ───────────────────────────────
  const handleEnd = async () => {
    setLoading(true);
    setError('');
    if (!endKm || !totalizerEnd) {
      setError('End KM and totalizer are required');
      setLoading(false);
      return;
    }
    try {
      await api.post('/trips/logout', {
        tripId,
        endKm:        Number(endKm),
        totalizerEnd: Number(totalizerEnd)
      });
      // Reset
      setAssigned(false);
      setStarted(false);
      setAssignOrderId('');
      setAssignRouteId('');
      setAssignVehicleNo('');
      setAssignDriverId('');
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

  // Filter orders for dropdown search
  const filteredOrders = orders.filter(o =>
    o._id.includes(search) ||
    o.customer?.custName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <TruckIcon size={24}/> Trip Manager
      </h2>
      {error && <div className="text-red-600">{error}</div>}

      {/* 1) ASSIGN */}
      {!assigned && (
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Trip No</label>
            <input
              readOnly
              value={tripNo}
              className="w-full bg-gray-100 border px-3 py-2 rounded"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Order</label>
            <input
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
                  {o.customer?.custName} — #{o._id.slice(-6)}
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="p-3 bg-gray-50 rounded space-y-1">
              <p><strong>Ship To:</strong> {selectedOrder.shipToAddress}</p>
              <p>
                <strong>Total Qty:</strong>{' '}
                {orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0)} L
              </p>
            </div>
          )}

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

          <div>
            <label className="block font-semibold mb-1">Vehicle</label>
            <select
              value={assignVehicleNo}
              onChange={e => setAssignVehicleNo(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">— Select Vehicle —</option>
              {vehiclesOnRoute.map(v => (
                <option key={v.vehicleNo} value={v.vehicleNo}>
                  {v.vehicleNo}
                </option>
              ))}
            </select>
          </div>

          {selectedVehicle && (
            <div className="p-3 bg-gray-50 rounded space-y-1">
              <p><strong>Capacity:</strong> {selectedVehicle.capacityLiters} L</p>
              {'calibratedCapacity' in selectedVehicle && (
                <p><strong>Calibrated:</strong> {selectedVehicle.calibratedCapacity} L</p>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1">
              Driver (PESO Lic #)
            </label>
            <select
              value={assignDriverId}
              onChange={e => setAssignDriverId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">— Select Driver —</option>
              {drivers.map(d => (
                <option key={d._id} value={d._id}>
                  {d.pesoLicenseNo} — {d.driverName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Load to Send (L)</label>
            <input
              type="number" min="0"
              value={sendCapacity}
              onChange={e => setSendCapacity(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Assigning…' : 'Assign Trip'}
          </button>
        </form>
      )}

      {/* 2) START */}
      {assigned && !started && (
        <>
          <div className="p-4 bg-green-100 rounded">
            <p>🎉 <strong>Trip ID:</strong> {tripId}</p>
            <p>🚚 <strong>Deliveries:</strong> {createdDeliveriesCount}</p>
          </div>
          <form onSubmit={handleStart} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded">
              <p>
                <strong>Driver:</strong>{' '}
                {drivers.find(d => d._id === assignDriverId)?.pesoLicenseNo} —{' '}
                {drivers.find(d => d._id === assignDriverId)?.driverName}
              </p>
            </div>

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
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              {loading ? 'Starting…' : 'Start Trip'}
            </button>
          </form>
        </>
      )}

      {/* 3) END */}
      {assigned && started && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <p><strong>Diesel Opening:</strong> {dieselOpening} L</p>
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
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
          >
            {loading ? 'Ending…' : 'End Trip'}
          </button>
        </div>
      )}
    </div>
  );
}
