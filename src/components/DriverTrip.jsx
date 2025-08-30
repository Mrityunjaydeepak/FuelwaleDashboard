// src/components/DriverAssignedTrips.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverAssignedTrips() {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes]   = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [driverId, setDriverId] = useState(null);
  const [driverDebug, setDriverDebug] = useState('');
  const [trips, setTrips] = useState([]);

  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');

  // UI state for start form
  const [selectedTrip, setSelectedTrip]   = useState(null);
  const [routeId, setRouteId]             = useState('');
  const [startKmInput, setStartKmInput]   = useState('');
  const [totalizerInput, setTotalizerInput] = useState('');
  const [formError, setFormError]         = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const navigate = useNavigate();

  // --- helpers ---------------------------------------------------------------
  const getVehicleNo = (t) =>
    t?.snapshot?.vehicleNo || t?.vehicle?.vehicleNo || t?.vehicleNo || '—';

  const decodeToken = () => {
    const token = localStorage.getItem('token');
    if (!token) return { reason: 'No token in storage' };

    let payload = null;
    try { payload = JSON.parse(atob(token.split('.')[1] || '')); }
    catch { return { reason: 'Invalid token payload' }; }

    // candidates for driver id
    const candidates = [
      payload?.driverId,
      payload?.driver?._id,
      payload?.driver?.id,
      payload?._id,
      payload?.id,
      payload?.sub
    ].filter(Boolean);

    const first = candidates.find(x => typeof x === 'string') || null;

    const hints = {
      empId:   payload?.empId || payload?.employeeId || payload?.profileId || payload?.profile?._id || null,
      empCd:   payload?.empCd || payload?.employeeCode || payload?.profile?.empCd || null,
      empName: payload?.empName || payload?.profile?.empName || payload?.name || null
    };

    if (first) return { driverId: first, reason: 'driverId from token', hints };
    return { reason: 'driverId not present in token', hints };
  };

  const pickDriverFromDrivers = (driversList) => {
    const decoded = decodeToken();
    let reason = decoded.reason || '';

    // A) if token.driverId exists and matches a driver in the list
    if (decoded.driverId) {
      const match = driversList.find(d => String(d._id) === String(decoded.driverId));
      if (match) return { driverId: match._id, reason: `${reason} (validated in DB)` };
      reason += ' (token driverId not found among drivers)';
    }

    // B) match by employee hints
    const { empId, empCd, empName } = decoded.hints || {};
    if (empId) {
      const byEmpId = driversList.find(d => String(d?.profile?._id) === String(empId));
      if (byEmpId) return { driverId: byEmpId._id, reason: 'matched by employee _id' };
    }
    if (empCd) {
      const byEmpCd = driversList.find(d => String(d?.profile?.empCd).toLowerCase() === String(empCd).toLowerCase());
      if (byEmpCd) return { driverId: byEmpCd._id, reason: 'matched by employee code' };
    }
    if (empName) {
      const byEmpName = driversList.find(d => String(d?.profile?.empName).toLowerCase() === String(empName).toLowerCase());
      if (byEmpName) return { driverId: byEmpName._id, reason: 'matched by employee name' };
    }

    // C) last resort (dev/test): if exactly one driver is ASSIGNED/ACTIVE, pick them
    const onTrip = driversList.filter(d => ['ASSIGNED', 'ACTIVE'].includes(d.currentTripStatus));
    if (onTrip.length === 1) {
      return { driverId: onTrip[0]._id, reason: `fallback: only driver on trip (${onTrip[0].driverName})` };
    }

    return { reason: reason || 'could not infer driver from token or drivers list' };
  };

  // --- load lookups ----------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [drv, rt, vh] = await Promise.all([
          api.get('/drivers'),
          api.get('/routes'),
          api.get('/vehicles')
        ]);
        setDrivers(Array.isArray(drv.data) ? drv.data : []);
        setRoutes(Array.isArray(rt.data) ? rt.data : []);
        setVehicles(Array.isArray(vh.data) ? vh.data : []);
      } catch (e) {
        setGlobalError('Failed to load master data');
      }
    })();
  }, []);

  // --- resolve driverId & load trips ----------------------------------------
  useEffect(() => {
    (async () => {
      if (!drivers.length) { setGlobalLoading(false); return; }

      setGlobalLoading(true);
      setGlobalError('');
      setTrips([]);

      const pick = pickDriverFromDrivers(drivers);
      if (!pick.driverId) {
        setDriverId(null);
        setDriverDebug(pick.reason || 'No driver id');
        setGlobalLoading(false);
        return;
      }

      const effectiveDriverId = String(pick.driverId);
      setDriverId(effectiveDriverId);
      setDriverDebug(pick.reason || 'resolved driver');

      // 1) try primary endpoint
      let assigned = [];
      try {
        const r = await api.get(`/trips/assigned/${effectiveDriverId}`);
        assigned = Array.isArray(r.data) ? r.data : [];
      } catch { /* continue */ }

      // 2) fallback to driver.currentTrip
      if (!assigned.length) {
        const drv = drivers.find(d => String(d._id) === effectiveDriverId);
        if (drv?.currentTrip) {
          try {
            const tr = await api.get(`/trips/${drv.currentTrip}`);
            const one = tr.data;
            if (one && one.status === 'ASSIGNED') {
              assigned = [one];
            }
          } catch { /* ignore */ }
        }
      }

      if (!assigned.length) {
        setGlobalError('No trips assigned for this driver (checked fleet & live link).');
        setGlobalLoading(false);
        return;
      }

      setTrips(assigned);
      setGlobalLoading(false);
    })();
  }, [drivers]);

  // --- prefill start form when trip selected ---------------------------------
  const selectedVehicle = useMemo(() => {
    if (!selectedTrip) return null;
    const vno = getVehicleNo(selectedTrip);
    return vehicles.find(v => String(v.vehicleNo).toLowerCase() === String(vno).toLowerCase()) || null;
  }, [selectedTrip, vehicles]);

  useEffect(() => {
    if (selectedTrip) {
      setRouteId('');
      setStartKmInput(selectedVehicle?.lastKm != null ? String(selectedVehicle.lastKm) : '');
      setTotalizerInput(selectedVehicle?.lastTotalizer != null ? String(selectedVehicle.lastTotalizer) : '');
      setFormError('');
    }
  }, [selectedTrip, selectedVehicle]);

  // --- render states ---------------------------------------------------------
  if (globalLoading) return <p>Loading…</p>;

  if (globalError) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6 space-y-2">
        <p className="text-red-600">{globalError}</p>
        <p className="text-xs text-gray-500">
          Debug: {driverDebug || '—'}{driverId ? ` (driverId=${driverId})` : ''}
        </p>
      </div>
    );
  }

  if (!trips.length) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6 space-y-2">
        <p>No trips assigned. Check back later.</p>
        <p className="text-xs text-gray-500">
          Debug: {driverDebug || '—'}{driverId ? ` (driverId=${driverId})` : ''}
        </p>
      </div>
    );
  }

  // --- start-trip form -------------------------------------------------------
  if (selectedTrip) {
    const vno = getVehicleNo(selectedTrip);
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
        <h2 className="text-2xl font-semibold mb-4">Start Trip</h2>
        {formError && <div className="text-red-600 mb-4">{formError}</div>}

        <p className="mb-1"><strong>Trip No:</strong> {selectedTrip.tripNo}</p>
        <p className="mb-1"><strong>Vehicle No:</strong> {vno}</p>
        <p className="mb-4"><strong>Assigned On:</strong> {new Date(selectedTrip.createdAt).toLocaleString()}</p>

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
            if (!routeId) { setFormError('Route is required.'); return; }
            const sk = Number(startKmInput), ts = Number(totalizerInput);
            if (!Number.isFinite(sk) || !Number.isFinite(ts)) {
              setFormError('KM and totalizer must be valid numbers.');
              return;
            }
            setFormError('');
            setSubmitting(true);
            try {
              const res = await api.post('/trips/login', {
                tripId: selectedTrip._id,     // preferred fleet flow
                driverId,                     // optional but helpful
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
          onClick={() => { setSelectedTrip(null); setFormError(''); }}
          className="mt-2 w-full bg-gray-300 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- assigned trips list ---------------------------------------------------
  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-semibold mb-4">Your Assigned Trips</h2>
      <ul className="space-y-4">
        {trips.map(t => {
          const vno = getVehicleNo(t);
          return (
            <li key={t._id} className="border rounded p-4 flex justify-between items-center">
              <div>
                <p><strong>Trip No:</strong> {t.tripNo}</p>
                <p><strong>Vehicle:</strong> {vno}</p>
                <p><strong>Assigned At:</strong> {new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedTrip(t)}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Start Trip
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        Debug: {driverDebug || '—'}{driverId ? ` (driverId=${driverId})` : ''}
      </p>
    </div>
  );
}
