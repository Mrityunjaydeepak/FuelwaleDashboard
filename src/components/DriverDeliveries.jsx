// src/components/DeliveryModule.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

export default function DeliveryModule() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const tripId     = state?.tripId;

  // ── Data ───────────────────────────────────────
  const [trip, setTrip]           = useState(null);
  const [pending, setPending]     = useState([]);
  const [completed, setCompleted] = useState([]);
  const [balance, setBalance]     = useState(null);

  // ── UI State ───────────────────────────────────
  const [view, setView]           = useState('pending');
  const [selected, setSelected]   = useState(null);
  const [qty, setQty]             = useState('');
  const [rate, setRate]           = useState('');
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showEndForm, setShowEndForm]   = useState(false);
  const [endKm, setEndKm]               = useState('');
  const [totalizerEnd, setTotalizerEnd] = useState('');
  const [ending, setEnding]             = useState(false);

  // ── helpers to read new trip shape ─────────────
  const vehicleNo =
    trip?.snapshot?.vehicleNo ||
    trip?.vehicle?.vehicleNo || // in case you populate vehicle on GET /trip/:id
    trip?.vehicleNo ||          // legacy fallback
    '—';

  const routeName  = trip?.routeName || '—';
  const driverName = trip?.driverName || '—';

  // ── Load on mount / tripId change ──────────────
  useEffect(() => {
    if (!tripId) return;
    refreshAll();
    // eslint-disable-next-line
  }, [tripId]);

  const refreshAll = () => {
    setError('');

    if (!tripId) return;

    api.get(`/trips/${tripId}`)
      .then(r => setTrip(r.data))
      .catch(() => setError('Failed to load trip'));

    api.get(`/deliveries/pending/${tripId}`)
      .then(r => setPending(r.data || []))
      .catch(() => setError('Failed to load pending deliveries'));

    api.get(`/deliveries/completed/${tripId}`)
      .then(r => setCompleted(r.data || []))
      .catch(() => setError('Failed to load completed deliveries'));

    api.get(`/bowserinventories/${tripId}`)
      .then(r => setBalance(r.data?.balanceLiters ?? 0))
      .catch(() => setBalance(0));

    // Reset forms
    setSelected(null);
    setQty('');
    setRate('');
    setShowEndForm(false);
    setEndKm('');
    setTotalizerEnd('');
  };

  // ──  Submit a delivery ─────────────────────────
  const handleDeliver = async () => {
    const q  = Number(qty);
    const rt = Number(rate);

    if (!selected || !selected.orderId) {
      setError('You must select a customer/order first');
      return;
    }
    if (Number.isNaN(q) || Number.isNaN(rt)) {
      setError('Qty and rate must be numbers');
      return;
    }
    if (q <= 0) {
      setError('Qty must be greater than 0');
      return;
    }
    if (balance != null && q > balance) {
      setError(`Insufficient stock. Only ${balance} L left.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/deliveries', {
        tripId,
        orderId:    selected.orderId,
        customerId: selected.customerId,
        shipTo:     selected.shipTo,
        qty:        q,
        rate:       rt
      });
      // Clear form & reload lists
      setSelected(null);
      setQty('');
      setRate('');
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Delivery failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Show end‐trip form ─────────────────────────
  const onRequestEnd = () => {
    setShowEndForm(true);
    setError('');
  };

  // ── Submit end‐trip ────────────────────────────
  const handleEndTrip = async () => {
    if (!endKm || !totalizerEnd) {
      setError('End KM and totalizer end are required');
      return;
    }
    const eKm  = Number(endKm);
    const tEnd = Number(totalizerEnd);
    if (trip?.startKm != null && eKm < Number(trip.startKm)) {
      setError(`End KM (${eKm}) cannot be less than start KM (${trip.startKm})`);
      return;
    }
    if (trip?.totalizerStart != null && tEnd < Number(trip.totalizerStart)) {
      setError(`Totalizer end (${tEnd}) cannot be less than start (${trip.totalizerStart})`);
      return;
    }

    setEnding(true);
    setError('');
    try {
      await api.post('/trips/logout', { tripId, endKm: eKm, totalizerEnd: tEnd });
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete trip');
    } finally {
      setEnding(false);
    }
  };

  // ── Download invoice ───────────────────────────
  const handleGenerateInvoice = async () => {
    setError('');
    try {
      const res = await api.get(`/trips/${tripId}/invoice`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${tripId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Invoice generation failed');
    }
  };

  // ── Tab counts ─────────────────────────────────
  const pendingCount   = pending.length + (trip?.status === 'ACTIVE' ? 1 : 0);
  const completedCount = completed.length + (trip?.status === 'COMPLETED' ? 1 : 0);

  // ── Render ─────────────────────────────────────
  if (!tripId) {
    return (
      <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-6">
        <h2 className="text-2xl font-semibold mb-4">Delivery Module</h2>
        <div className="text-red-600 mb-3">No trip selected.</div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-200 px-3 py-2 rounded"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-semibold mb-4">Delivery Module</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}

      {/* Tabs */}
      <div className="flex mb-4">
        <button
          className={`flex-1 py-2 ${view==='pending' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={()=>setView('pending')}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={`flex-1 py-2 ${view==='completed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={()=>setView('completed')}
        >
          Completed ({completedCount})
        </button>
      </div>

      <p className="mb-4">
        <strong>Bowser Balance:</strong>{' '}
        {balance != null ? `${balance} L` : 'Loading…'}
      </p>

      {view==='pending' && (
        <>
          {trip?.status === 'ACTIVE' && (
            <div className="mb-4 p-4 border rounded">
              <div className="flex justify-between">
                <div>
                  <p><strong>Trip ID:</strong> {trip._id}</p>
                  <p className="text-sm"><strong>Route:</strong> {routeName}</p>
                  <p className="text-sm"><strong>Vehicle:</strong> {vehicleNo}</p>
                  <p className="text-sm"><strong>Driver:</strong> {driverName}</p>
                </div>
                {!showEndForm && (
                  <button
                    onClick={onRequestEnd}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    End Trip
                  </button>
                )}
              </div>
              {showEndForm && (
                <div className="mt-4 space-y-3">
                  {/* End-trip inputs */}
                  <div>
                    <label className="block mb-1">End KMs</label>
                    <input
                      type="number"
                      value={endKm}
                      onChange={e => setEndKm(e.target.value)}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Totalizer End</label>
                    <input
                      type="number"
                      value={totalizerEnd}
                      onChange={e => setTotalizerEnd(e.target.value)}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleEndTrip}
                      disabled={ending}
                      className="flex-1 bg-red-600 text-white py-2 rounded"
                    >
                      {ending ? 'Ending…' : 'Confirm End'}
                    </button>
                    <button
                      onClick={()=>{ setShowEndForm(false); setError(''); }}
                      disabled={ending}
                      className="flex-1 bg-gray-300 py-2 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selected ? (
            <ul className="space-y-2 mb-4">
              {pending.map(item => (
                <li key={item._id} className="p-3 border rounded flex justify-between">
                  <div>
                    <p><strong>{item.customerName}</strong></p>
                    <p className="text-sm">{item.shipTo}</p>
                    <p className="text-sm">Req: {item.requiredQty} L</p>
                  </div>
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded"
                    onClick={()=>setSelected(item)}
                  >
                    Deliver
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-4 p-4 border rounded">
              <p><strong>Deliver to:</strong> {selected.customerName}</p>
              <p><strong>Address:</strong> {selected.shipTo}</p>
              <p><strong>Required:</strong> {selected.requiredQty} L</p>
              <div className="mb-3">
                <label className="block mb-1">Qty (L)</label>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
              <div className="mb-3">
                <label className="block mb-1">Rate</label>
                <input
                  type="number"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDeliver}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded"
                >
                  {submitting ? 'Delivering…' : 'Confirm Delivery'}
                </button>
                <button
                  onClick={()=>{ setSelected(null); setError(''); }}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {view==='completed' && (
        <>
          {trip?.status === 'COMPLETED' && (
            <div className="mb-4 p-4 border rounded flex justify-between items-center">
              <div>
                <p><strong>Trip ID:</strong> {trip._id}</p>
                <p className="text-sm"><strong>Route:</strong> {routeName}</p>
                <p className="text-sm"><strong>Vehicle:</strong> {vehicleNo}</p>
                <p className="text-sm"><strong>Driver:</strong> {driverName}</p>
              </div>
              <button
                onClick={handleGenerateInvoice}
                className="bg-indigo-600 text-white px-3 py-1 rounded"
              >
                Generate Invoice
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {completed.map(d => (
              <li key={d._id} className="p-3 border rounded">
                <p>
                  <strong>{d.customerName}</strong> — {d.qty} L @ {d.rate} — ₹{Number(d.qty) * Number(d.rate)}
                </p>
                <p className="text-sm text-gray-600">
                  {d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
