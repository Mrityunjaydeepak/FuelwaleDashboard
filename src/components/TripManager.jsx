import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';

export default function TripManager() {
  const { state } = useLocation();
  const order     = state?.order;

  // ── Master data ─────────────────────────────
  const [drivers, setDrivers]   = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes]     = useState([]);

  // ── Workflow flags ──────────────────────────
  const [assigned, setAssigned] = useState(false);
  const [started, setStarted]   = useState(false);

  // ── Assignment form state ───────────────────
  const [assignDriverId, setAssignDriverId]     = useState('');
  const [assignVehicleNo, setAssignVehicleNo]   = useState('');
  const [assignRouteId, setAssignRouteId]       = useState('');
  const [sendCapacity, setSendCapacity]         = useState('');

  // ── Start‐trip form state ───────────────────
  const [driverId, setDriverId]                 = useState('');
  const [vehicleNo, setVehicleNo]               = useState('');
  const [routeId, setRouteId]                   = useState('');
  const [remarks, setRemarks]                   = useState('');
  const [startKm, setStartKm]                   = useState('');
  const [totalizerStart, setTotalizerStart]     = useState('');

  // ── End‐trip form state ─────────────────────
  const [endKm, setEndKm]                       = useState('');
  const [totalizerEnd, setTotalizerEnd]         = useState('');

  // ── Active trip data ───────────────────────
  const [tripId, setTripId]                     = useState('');
  const [dieselOpening, setDieselOpening]       = useState(null);
  const [deliveries, setDeliveries]             = useState([]);

  // ── How many deliveries were seeded ─────────
  const [createdDeliveriesCount, setCreatedDeliveriesCount] = useState(0);

  // ── UI ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Fetch master data once
  useEffect(() => {
    api.get('/drivers')
      .then(r => setDrivers(r.data))
      .catch(() => setError('Failed to load drivers'));

    api.get('/vehicles')
      .then(r => setVehicles(r.data))
      .catch(() => setError('Failed to load vehicles'));

    api.get('/routes')
      .then(r => setRoutes(r.data))
      .catch(() => setError('Failed to load routes'));
  }, []);

  // ── 1) Assign Trip ────────────────────────────
  const handleAssign = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!assignDriverId || !assignVehicleNo || !assignRouteId || !sendCapacity) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      const res = await api.post('/trips/assign', {
        driverId:  assignDriverId,
        vehicleNo: assignVehicleNo,
        routeId:   assignRouteId,
        capacity:  Number(sendCapacity),
        orderId:   order?._id                    // ← specify the exact order
      });

      const newTripId = res.data.tripId;
      setTripId(newTripId);
      setDriverId(assignDriverId);
      setVehicleNo(assignVehicleNo);
      setRouteId(assignRouteId);
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
    try {
      if (!routeId || !startKm || !totalizerStart) {
        setError('Route, start KM and totalizer are required');
        setLoading(false);
        return;
      }
      const res = await api.post('/trips/login', {
        driverId,
        vehicleNo,
        routeId,
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
    try {
      if (!endKm || !totalizerEnd) {
        setError('End KM and totalizer are required');
        setLoading(false);
        return;
      }
      await api.post('/trips/logout', {
        tripId,
        endKm:        Number(endKm),
        totalizerEnd: Number(totalizerEnd)
      });
      // Reset all state
      setAssigned(false);
      setStarted(false);
      setAssignDriverId('');
      setAssignVehicleNo('');
      setAssignRouteId('');
      setSendCapacity('');
      setDriverId('');
      setVehicleNo('');
      setRouteId('');
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

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-semibold mb-4">Trip Manager</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}

      {/* ── Order Details ───────────────────────── */}
      {order && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Order Details</h3>
          <p><strong>Order No:</strong> {order._id.toString().slice(-6)}</p>
          <p><strong>Customer:</strong> {order.customer?.custName}</p>
          <p><strong>Ship To:</strong> {order.shipToAddress}</p>
          <p>
            <strong>Total Qty:</strong>{' '}
            {order.items.reduce((sum, i) => sum + i.quantity, 0)} L
          </p>
          <div className="mt-2 font-semibold">Items:</div>
          <ul className="list-disc pl-5">
            {order.items.map((item, i) => (
              <li key={i}>
                {item.productName} — {item.quantity} L @ {item.rate} = ₹{item.quantity * item.rate}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 1) Assign Trip ──────────────────────────── */}
      {!assigned && (
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block mb-1">Driver</label>
            <select
              value={assignDriverId}
              onChange={e => setAssignDriverId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">-- Select driver --</option>
              {drivers.map(d => (
                <option key={d._id} value={d._id}>{d.driverName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Vehicle</label>
            <select
              value={assignVehicleNo}
              onChange={e => setAssignVehicleNo(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">-- Select vehicle --</option>
              {vehicles.map(v => (
                <option key={v.licensePlate} value={v.licensePlate}>
                  {v.licensePlate}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Route</label>
            <select
              value={assignRouteId}
              onChange={e => setAssignRouteId(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">-- Select route --</option>
              {routes.map(r => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Capacity (L)</label>
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
            className="w-full bg-blue-600 text-white py-2 rounded"
          >
            {loading ? 'Assigning…' : 'Assign Trip'}
          </button>
        </form>
      )}

      {/* ── 2) Assignment Confirmation & Start ───────── */}
      {assigned && !started && (
        <>
          <div className="mb-4 p-4 bg-green-100 rounded">
            <p>🎉 <strong>Trip assigned:</strong> {tripId}</p>
            <p>🚚 <strong>Deliveries created:</strong> {createdDeliveriesCount}</p>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <p><strong>Driver:</strong> {drivers.find(d => d._id === driverId)?.driverName}</p>
            <p><strong>Vehicle:</strong> {vehicleNo}</p>
            <p><strong>Capacity:</strong> {sendCapacity} L</p>

            <div>
              <label className="block mb-1">Route</label>
              <select
                value={routeId}
                onChange={e => setRouteId(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">-- Select route --</option>
                {routes.map(r => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Remarks</label>
              <input
                type="text"
                placeholder="Any notes…"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div>
              <label className="block mb-1">Start KMs</label>
              <input
                type="number"
                value={startKm}
                onChange={e => setStartKm(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div>
              <label className="block mb-1">Totalizer Start</label>
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
              className="w-full bg-green-600 text-white py-2 rounded"
            >
              {loading ? 'Starting…' : 'Start Trip'}
            </button>
          </form>
        </>
      )}

      {/* ── 3) Active Trip & End‐Trip ─────────────────────── */}
      {assigned && started && (
        <div className="space-y-4">
          <p><strong>Trip ID:</strong> {tripId}</p>
          <p><strong>Driver:</strong> {drivers.find(d => d._id === driverId)?.driverName}</p>
          <p><strong>Vehicle:</strong> {vehicleNo}</p>
          <p><strong>Capacity:</strong> {sendCapacity} L</p>
          <p><strong>Route:</strong> {routes.find(r => r._id === routeId)?.name}</p>
          {remarks && <p><strong>Remarks:</strong> {remarks}</p>}
          <p><strong>Diesel Opening:</strong> {dieselOpening} L</p>

          <div>
            <label className="block mb-1">End KMs</label>
            <input
              type="number"
              value={endKm}
              onChange={e => setEndKm(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Totalizer End</label>
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
            className="w-full bg-red-600 text-white py-2 rounded"
          >
            {loading ? 'Ending…' : 'End Trip'}
          </button>
        </div>
      )}
    </div>
  );
}
