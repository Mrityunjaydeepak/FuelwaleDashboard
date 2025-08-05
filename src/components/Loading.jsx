import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

export default function LoadingModule() {
  const { state }      = useLocation();
  const navigate       = useNavigate();
  const tripId         = state?.tripId;

  const [trip, setTrip]                   = useState(null);
  const [stations, setStations]           = useState([]);
  const [initializing, setInitializing]   = useState(true);
  const [globalError, setGlobalError]     = useState('');

  const [stationId, setStationId]       = useState('');
  const [product, setProduct]           = useState('');
  const [qty, setQty]                   = useState('');
  const [formError, setFormError]       = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    if (!tripId) {
      setGlobalError('No trip selected.');
      setInitializing(false);
      return;
    }
    (async () => {
      try {
        // 1) load trip with populated vehicle → vehicle.depot
        const { data: tripData } = await api.get(`/trips/${tripId}`);
        setTrip(tripData);

        // 2) load stations
        const { data: stationsData } = await api.get(
          `/loadings/stations/${tripData.routeId}`
        );
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

  const balanceLiters = trip.balanceLiters != null
    ? `${trip.balanceLiters} L`
    : '—';

  // vehicle fields from populated trip.vehicle
  const vehicleId = trip.vehicle?._id;
  const vehicleNo = trip.vehicle?.vehicleNo;
  const depotCd   = trip.vehicle?.depot?.depotCd;

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6 space-y-6">
      <h2 className="text-2xl font-semibold">Record Loading</h2>

      {/* Vehicle Info */}
      {vehicleNo && (
        <div className="p-4 bg-gray-100 rounded space-y-1">
          <p><strong>Vehicle No.:</strong> {vehicleNo}</p>
          <p><strong>Depot Code:</strong> {depotCd}</p>
        </div>
      )}

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
            <option key={s.id} value={s.id}>{s.name}</option>
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
        disabled={submitting}
        onClick={async () => {
          if (!stationId || !product || !qty) {
            setFormError('All fields are required.');
            return;
          }
          if (!vehicleId) {
            setFormError('Vehicle ID is missing.');
            return;
          }
          if (!depotCd) {
            setFormError('Depot code is missing.');
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
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        {submitting ? 'Submitting…' : 'Fill'}
      </button>
    </div>
  );
}
