import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverAssignedTrips() {
  const [driverId, setDriverId]             = useState(null);
  const [vehicles, setVehicles]             = useState([]);
  const [routes, setRoutes]                 = useState([]);
  const [trips, setTrips]                   = useState([]);
  const [globalLoading, setGlobalLoading]   = useState(true);
  const [globalError, setGlobalError]       = useState('');

  // UI state for the start‐trip form
  const [selectedTrip, setSelectedTrip]       = useState(null);
  const [routeId, setRouteId]                 = useState('');
  const [startKmInput, setStartKmInput]       = useState('');
  const [totalizerInput, setTotalizerInput]   = useState('');
  const [formError, setFormError]             = useState('');
  const [submitting, setSubmitting]           = useState(false);

  const navigate = useNavigate();

  // 1️⃣ Decode driverId from JWT
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setGlobalError('Not authenticated');
      setGlobalLoading(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.driverId) setDriverId(payload.driverId);
      else setGlobalError('You are not a driver');
    } catch {
      setGlobalError('Invalid token');
    }
  }, []);

  // 2️⃣ Fetch vehicles, routes & assigned trips
  useEffect(() => {
    if (!driverId) return;
    setGlobalLoading(true);
    Promise.all([
      api.get('/vehicles').then(r => setVehicles(r.data)),
      api.get('/routes').then(r => setRoutes(r.data)),
      api.get(`/trips/assigned/${driverId}`).then(r => setTrips(r.data))
    ])
      .catch(() => setGlobalError('Failed to load data'))
      .finally(() => setGlobalLoading(false));
  }, [driverId]);

  // Find vehicle for selected trip
  const vehicle = selectedTrip
    ? vehicles.find(v => v.licensePlate === selectedTrip.vehicleNo)
    : null;

  // 3️⃣ Prefill form when trip & vehicle are ready
  useEffect(() => {
    if (selectedTrip && vehicle) {
      setRouteId(''); // force driver to choose
      setStartKmInput(String(vehicle.lastKm ?? ''));
      setTotalizerInput(String(vehicle.lastTotalizer ?? ''));
      setFormError('');
    }
  }, [selectedTrip, vehicle]);

  // Global states
  if (globalLoading) return <p>Loading…</p>;
  if (globalError)   return <p className="text-red-600">{globalError}</p>;
  if (!driverId)     return <p>Please log in as a driver.</p>;
  if (trips.length === 0) return <p>No trips assigned. Check back later.</p>;

  // 4️⃣ If a trip is selected, show start‐trip form
  if (selectedTrip) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
        <h2 className="text-2xl font-semibold mb-4">Start Trip</h2>
        {formError && <div className="text-red-600 mb-4">{formError}</div>}

        <p><strong>Driver ID:</strong> {driverId}</p>
        <p><strong>Vehicle No:</strong> {selectedTrip.vehicleNo}</p>

        <div className="mb-4">
          <label className="block mb-1">Route</label>
          <select
            value={routeId}
            onChange={e => setRouteId(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">-- Select route --</option>
            {routes.map(r => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1">Start KM</label>
          <input
            type="number"
            value={startKmInput}
            onChange={e => setStartKmInput(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1">Totalizer Start</label>
          <input
            type="number"
            value={totalizerInput}
            onChange={e => setTotalizerInput(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <button
          onClick={async () => {
            // validate all fields
            if (!routeId) {
              setFormError('Route is required.');
              return;
            }
            const sk = Number(startKmInput), ts = Number(totalizerInput);
            if (isNaN(sk) || isNaN(ts)) {
              setFormError('KM and totalizer must be valid numbers.');
              return;
            }
            // submit
            setFormError('');
            setSubmitting(true);
            try {
              const res = await api.post('/trips/login', {
                driverId,
                vehicleNo: selectedTrip.vehicleNo,
                routeId,
                startKm: sk,
                totalizerStart: ts
              });
              navigate('/loading', { state: { tripId: res.data.tripId } });
            } catch (err) {
              setFormError(err.response?.data?.error || 'Could not start trip');
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {submitting ? 'Starting…' : 'Confirm & Start'}
        </button>

        <button
          onClick={() => {
            setSelectedTrip(null);
            setFormError('');
          }}
          className="mt-2 w-full bg-gray-300 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    );
  }

  // 5️⃣ Otherwise, list assigned trips
  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-semibold mb-4">Your Assigned Trips</h2>
      <ul className="space-y-4">
        {trips.map(t => (
          <li
            key={t._id}
            className="border rounded p-4 flex justify-between items-center"
          >
            <div>
              <p><strong>Vehicle:</strong> {t.vehicleNo}</p>
              <p>
                <strong>Assigned At:</strong>{' '}
                {new Date(t.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => setSelectedTrip(t)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Start Trip
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
