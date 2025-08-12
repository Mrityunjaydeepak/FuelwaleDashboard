import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

export default function LoadingModule() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const tripId    = state?.tripId;

  const [trip, setTrip]                 = useState(null);
  const [stations, setStations]         = useState([]);
  const [initializing, setInitializing] = useState(true);
  const [globalError, setGlobalError]   = useState('');

  const [stationId, setStationId]     = useState('');
  const [product, setProduct]         = useState('');
  const [qty, setQty]                 = useState('');
  const [formError, setFormError]     = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // ---------- helpers ----------
  const sanitize = (s) =>
    String(s || '')
      .toUpperCase()
      .replace(/[\s\-._]/g, ''); // remove spaces, dashes, dots, underscores

  function normalizeVehicleShape(v) {
    if (!v) return null;
    const out = { ...v };
    // Normalize depot shape so FE can always read vehicle.depot.depotCd
    if (!out.depot && out.depotCd) {
      out.depot = { depotCd: out.depotCd };
    }
    return out;
  }

  async function resolveVehicle(vehicleNoFromTrip) {
    try {
      // try to resolve quickly without fetching list
      // (the backend /trips/:id may already have included a partial "vehicle")
      // but if not present, fetch the list and match locally
      const { data: allVehicles } = await api.get('/vehicles');

      const target = String(vehicleNoFromTrip || '');
      const targetSan = sanitize(target);

      // 1) strict direct equality on vehicleNo or licensePlate
      let v =
        allVehicles.find(v => v.vehicleNo === target) ||
        allVehicles.find(v => v.licensePlate === target);

      // 2) case-insensitive exact
      if (!v) {
        const tLower = target.toLowerCase();
        v =
          allVehicles.find(v => String(v.vehicleNo || '').toLowerCase() === tLower) ||
          allVehicles.find(v => String(v.licensePlate || '').toLowerCase() === tLower);
      }

      // 3) sanitized (ignore spaces/dashes/dots)
      if (!v) {
        v = allVehicles.find(v => sanitize(v.vehicleNo) === targetSan) ||
            allVehicles.find(v => sanitize(v.licensePlate) === targetSan);
      }

      return normalizeVehicleShape(v) || null;
    } catch (e) {
      // fail silently; caller will show proper UI error
      return null;
    }
  }

  // ---------- init ----------
  useEffect(() => {
    if (!tripId) {
      setGlobalError('No trip selected.');
      setInitializing(false);
      return;
    }
    (async () => {
      try {
        // 1) load trip (may or may not include vehicle info)
        const { data: tripData } = await api.get(`/trips/${tripId}`);

        let vehicle = normalizeVehicleShape(tripData.vehicle);

        // 2) if vehicle missing or doesn't have depotCd, resolve via /vehicles
        const needsVehicle =
          !vehicle ||
          !(vehicle._id) ||
          !(vehicle.depot && vehicle.depot.depotCd);

        if (needsVehicle) {
          const resolved = await resolveVehicle(tripData.vehicleNo);
          if (resolved) {
            vehicle = resolved;
          }
        }

        // 3) save merged trip
        setTrip({ ...tripData, vehicle });

        // 4) load stations for route
        if (!tripData.routeId) {
          setGlobalError('Trip has no route assigned.');
          return;
        }
        const { data: stationsData } = await api.get(`/loadings/stations/${tripData.routeId}`);
        setStations(stationsData);
      } catch (err) {
        setGlobalError(err.response?.data?.error || 'Initialization failed.');
      } finally {
        setInitializing(false);
      }
    })();
  }, [tripId]);

  if (initializing) return <p>Initializing…</p>;
  if (globalError)  return <p className="text-red-600">{globalError}</p>;
  if (!trip)        return <p>Loading trip…</p>;

  const balanceLiters = trip.balanceLiters != null ? `${trip.balanceLiters} L` : '—';

  // vehicle fields from trip.vehicle (normalized)
  const vehicleId = trip.vehicle?._id || null;
  const vehicleNo = trip.vehicle?.vehicleNo || trip.vehicleNo || '—';
  const depotCd   = trip.vehicle?.depot?.depotCd || null;

  const readyToSubmit = Boolean(stationId && product && qty && vehicleId && depotCd);

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6 space-y-6">
      <h2 className="text-2xl font-semibold">Record Loading</h2>

      {/* Vehicle Info */}
      <div className="p-4 bg-gray-100 rounded space-y-1">
        <p><strong>Vehicle No.:</strong> {vehicleNo}</p>
        <p>
          <strong>Depot Code:</strong>{' '}
          {depotCd || <span className="text-red-700">Missing</span>}
        </p>
        {!vehicleId && (
          <p className="text-red-700 text-sm">
            Couldn’t resolve this vehicle in the system — check the vehicle number in the Trip.
          </p>
        )}
      </div>

      {/* Current Diesel Balance */}
      <div>
        <p><strong>Current Diesel Balance:</strong> {balanceLiters}</p>
      </div>

      {formError && <div className="text-red-600">{formError}</div>}

      {/* Station */}
      <div>
        <label className="block mb-1">Station</label>
        <select
          value={stationId}
          onChange={e => setStationId(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">— Select station —</option>
          {stations.map(s => (
            <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Product */}
      <div>
        <label className="block mb-1">Product</label>
        <input
          type="text"
          value={product}
          onChange={e => setProduct(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {/* Quantity */}
      <div>
        <label className="block mb-1">Quantity (L)</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {/* Submit */}
      <button
        disabled={submitting || !readyToSubmit}
        onClick={async () => {
          if (!stationId || !product || !qty) {
            setFormError('All fields are required.');
            return;
          }
          if (!vehicleId) {
            setFormError('Vehicle not found in system. Please contact dispatch.');
            return;
          }
          if (!depotCd) {
            setFormError('Depot code is missing. Please update the vehicle record.');
            return;
          }
          setFormError('');
          setSubmitting(true);

          try {
            await api.post('/loadings', {
              tripId,
              stationId,
              product,
              qty: Number(qty),
              vehicleId,
              depotCd
            });
            navigate('/driver-deliveries', { state: { tripId } });
          } catch (err) {
            setFormError(err.response?.data?.error || 'Recording failed');
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Fill'}
      </button>
    </div>
  );
}
