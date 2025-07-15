import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

export default function LoadingModule() {
  const { state }      = useLocation();
  const navigate       = useNavigate();
  const tripId         = state?.tripId;

  // ── Data + UI flags ───────────────────────────
  const [trip, setTrip]                 = useState(null);
  const [stations, setStations]         = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [globalError, setGlobalError]   = useState('');

  // ── Code flow ────────────────────────────────
  const [codeRequired, setCodeRequired] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [codeInput, setCodeInput]       = useState('');
  const [codeError, setCodeError]       = useState('');

  // ── Form state ───────────────────────────────
  const [stationId, setStationId]   = useState('');
  const [product, setProduct]       = useState('');
  const [qty, setQty]               = useState('');
  const [formError, setFormError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 1) Initialization ─────────────────────────
  useEffect(() => {
    if (!tripId) {
      setGlobalError('No trip selected.');
      setIsInitializing(false);
      return;
    }
    (async () => {
      try {
        // a) load trip
        const tripRes = await api.get(`/trips/${tripId}`);
        setTrip(tripRes.data);

        // b) load stations
        const stationsRes = await api.get(`/loadings/stations/${tripRes.data.routeId}`);
        setStations(stationsRes.data);

        // c) generate code
        const codeRes = await api.post('/loadings/generate-code', { tripId });
        setCodeRequired(codeRes.data.codeRequired);
        if (!codeRes.data.codeRequired) {
          setIsCodeVerified(true);
        }
      } catch (err) {
        setGlobalError(err.response?.data?.error || 'Initialization failed.');
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [tripId]);

  // ── 2) Early exits ─────────────────────────────
  if (isInitializing) {
    return <p>Initializing loading module…</p>;
  }
  if (globalError) {
    return <p className="text-red-600">{globalError}</p>;
  }
  if (!trip) {
    // trip is still null, so never read trip.balanceLiters yet
    return <p>Loading trip details…</p>;
  }
  if (codeRequired && !isCodeVerified) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
        <h2 className="text-2xl font-semibold mb-4">Enter Authorization Code</h2>
        {codeError && <div className="text-red-600 mb-2">{codeError}</div>}
        <input
          type="text"
          placeholder="6-digit code"
          maxLength={6}
          value={codeInput}
          onChange={e => setCodeInput(e.target.value)}
          className="w-full border px-3 py-2 rounded mb-4"
        />
        <button
          onClick={async () => {
            setCodeError('');
            try {
              await api.post('/loadings/verify-code', { tripId, code: codeInput });
              setIsCodeVerified(true);
            } catch (err) {
              setCodeError(err.response?.data?.error || 'Invalid code');
            }
          }}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Verify Code
        </button>
      </div>
    );
  }

  // ── 3) Main loading form (safe to read trip.balanceLiters) ─────────────────────────
  const balanceLitersDisplay =
    trip.balanceLiters != null
      ? `${trip.balanceLiters} L`
      : '—';

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-semibold mb-4">Record Loading</h2>

      <div className="mb-4">
        <p>
          <strong>Current Diesel Balance:</strong> {balanceLitersDisplay}
        </p>
      </div>

      {formError && <div className="text-red-600 mb-2">{formError}</div>}

      <div className="mb-4">
        <label className="block mb-1">Station</label>
        <select
          value={stationId}
          onChange={e => setStationId(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">-- Select station --</option>
          {stations.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Product</label>
        <input
          type="text"
          value={product}
          onChange={e => setProduct(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-1">Quantity (L)</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <button
        disabled={isSubmitting}
        onClick={async () => {
          if (!stationId || !product || !qty) {
            setFormError('All fields are required.');
            return;
          }
          setFormError('');
          setIsSubmitting(true);

          const payload = {
            tripId,
            stationId,
            product,
            qty: Number(qty),
            ...(codeRequired ? { code: codeInput } : {})
          };

          try {
            await api.post('/loadings', payload);
            navigate('/driver-deliveries', { state: { tripId } });
          } catch (err) {
            setFormError(err.response?.data?.error || 'Recording failed');
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="w-full bg-green-600 text-white py-2 rounded"
      >
        {isSubmitting ? 'Submitting…' : 'Fill'}
      </button>
    </div>
  );
}
