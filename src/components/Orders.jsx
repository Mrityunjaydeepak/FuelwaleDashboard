// src/components/ManageOrders.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { ShoppingCart, PlusIcon, Trash2, X, CheckCircle2 } from 'lucide-react';

export default function ManageOrders() {
  const initialForm = {
    customerId: '',
    shipToAddress: '',
    items: [{ productName: 'diesel', quantity: '', rate: '' }],
    deliveryDate: '',
    deliveryTimeStart: '',
    deliveryTimeEnd: '',
    orderType: 'Regular'
  };

  const [form, setForm] = useState(initialForm);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // selected ship-to key: 'shipTo1'..'shipTo5'
  const [shipToChoice, setShipToChoice] = useState('shipTo1');

  const selectedCustomer = useMemo(
    () => customers.find(c => String(c._id) === String(form.customerId)) || null,
    [customers, form.customerId]
  );

  // Format a shipping block (1..5) from individual fields
  const buildShipToValueFromFields = (c, idx) => {
    const a1 = c?.[`shipTo${idx}Add1`] || '';
    const a2 = c?.[`shipTo${idx}Add2`] || '';
    const a3 = c?.[`shipTo${idx}Add3`] || '';
    const area = c?.[`shipTo${idx}Area`] || '';
    const city = c?.[`shipTo${idx}City`] || '';
    const pin = c?.[`shipTo${idx}Pin`] != null && c[`shipTo${idx}Pin`] !== '' ? String(c[`shipTo${idx}Pin`]) : '';
    const st  = c?.[`shipTo${idx}StateCd`] || '';

    const lines = [a1, a2, a3].filter(Boolean).join('\n');
    const areaCity = [area, city].filter(Boolean).join(', ');
    const tail = [pin, st].filter(Boolean).join(', ');

    return [lines, areaCity, tail].filter(Boolean).join('\n').trim();
  };

  // Fallback: format from legacy c.shipTo[idx-1]
  const buildShipToValueFromArray = (c, idx) => {
    const arr = Array.isArray(c?.shipTo) ? c.shipTo : [];
    const raw = arr[idx - 1];
    if (!raw) return '';
    // accept either string or object with fields
    if (typeof raw === 'string') return raw.trim();
    if (raw && typeof raw === 'object') {
      const { add1, add2, add3, area, city, pin, stateCd } = raw;
      const lines = [add1, add2, add3].filter(Boolean).join('\n');
      const areaCity = [area, city].filter(Boolean).join(', ');
      const tail = [pin, stateCd].filter(Boolean).join(', ');
      return [lines, areaCity, tail].filter(Boolean).join('\n').trim();
    }
    return '';
  };

  // Build 5 options using fields; if empty, try legacy array
  const shipToOptions = useMemo(() => {
    if (!selectedCustomer) return [];
    const opts = [];
    for (let i = 1; i <= 5; i++) {
      let value = buildShipToValueFromFields(selectedCustomer, i);
      if (!value) value = buildShipToValueFromArray(selectedCustomer, i);
      const firstLine =
        selectedCustomer[`shipTo${i}Add1`] ||
        (typeof (selectedCustomer.shipTo?.[i - 1]) === 'string'
          ? selectedCustomer.shipTo[i - 1].split('\n')[0]
          : selectedCustomer.shipTo?.[i - 1]?.add1) ||
        value.split('\n')[0] ||
        '';
      opts.push({
        key: `shipTo${i}`,
        label: `Address ${i}: ${firstLine || '(empty)'}`,
        value,
        empty: value.length === 0
      });
    }
    return opts;
  }, [selectedCustomer]);

  // Load customers from the full /customers endpoint so we actually get all fields
  useEffect(() => {
    let alive = true;
    api.get('/customers')
      .then(res => {
        if (!alive) return;
        setCustomers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load customers'));
    return () => { alive = false; };
  }, []);

  // When customer changes, pick first non-empty address (fallback to Address 1)
  useEffect(() => {
    if (!selectedCustomer) {
      setShipToChoice('shipTo1');
      setForm(f => ({ ...f, shipToAddress: '' }));
      return;
    }
    if (shipToOptions.length) {
      const firstNonEmpty = shipToOptions.find(o => !o.empty) || shipToOptions[0];
      setShipToChoice(firstNonEmpty.key);
      setForm(f => ({ ...f, shipToAddress: firstNonEmpty.value }));
    }
  }, [selectedCustomer, shipToOptions]);

  const handleFormChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const handleItemChange = (idx, e) => {
    const { name, value } = e.target;
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [name]: value };
      return { ...f, items };
    });
    setError('');
  };

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { productName: 'diesel', quantity: '', rate: '' }]
    }));
  };

  const removeItem = (idx) => {
    setForm(f => {
      if (f.items.length === 1) return f; // keep at least one
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items };
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!form.customerId) return setError('Please select a customer.');
    if (!form.deliveryDate) return setError('Please select a delivery date.');
    if (!form.deliveryTimeStart || !form.deliveryTimeEnd) return setError('Please select a delivery time range.');
    if (form.deliveryTimeEnd <= form.deliveryTimeStart) return setError('Time To must be later than Time From.');

    const cleanedItems = form.items
      .map(i => ({
        productName: (i.productName || '').trim() || 'diesel',
        quantity: Number(i.quantity),
        rate: Number(i.rate)
      }))
      .filter(i => i.quantity > 0 && i.rate >= 0);

    if (cleanedItems.length === 0) return setError('Please add at least one item with a quantity > 0.');

    const deliveryTimeSlot = `${form.deliveryTimeStart} - ${form.deliveryTimeEnd}`;
    const payload = {
      customerId: form.customerId,
      shipToAddress: form.shipToAddress,
      orderType: form.orderType,
      items: cleanedItems,
      deliveryDate: form.deliveryDate,
      deliveryTimeSlot
    };

    setPendingPayload(payload);
    setShowConfirm(true);
  };

  const confirmAndPost = async () => {
    if (!pendingPayload) return;
    setLoading(true);
    try {
      await api.post('/orders', pendingPayload);
      setForm(initialForm);
      setShipToChoice('shipTo1');
      setPendingPayload(null);
      setShowConfirm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const activeCustomers   = customers.filter(c => c.status === 'Active');
  const inactiveCustomers = customers.filter(c => c.status !== 'Active');

  const handleShipToChoiceChange = (e) => {
    const key = e.target.value;
    setShipToChoice(key);
    const opt = shipToOptions.find(o => o.key === key);
    setForm(f => ({ ...f, shipToAddress: opt ? opt.value : '' }));
  };

  const orderTotal = useMemo(() => {
    return form.items.reduce((sum, it) => {
      const q = Number(it.quantity || 0);
      const r = Number(it.rate || 0);
      return sum + (isFinite(q) && isFinite(r) ? q * r : 0);
    }, 0);
  }, [form.items]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <ShoppingCart size={24} /> Order Management
      </h2>

      <div className="bg-white p-6 rounded-lg shadow max-w-md mx-auto">
        <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
          <PlusIcon size={20} /> Create New Order
        </h3>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer select */}
          <div>
            <label className="block text-sm mb-1">Customer</label>
            <select
              name="customerId"
              value={form.customerId}
              onChange={handleFormChange}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Customer</option>

              {activeCustomers.length > 0 && (
                <optgroup label="Active">
                  {activeCustomers.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.custCd} — {c.custName} — ₹{Number(c.outstanding || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                </optgroup>
              )}

              {inactiveCustomers.length > 0 && (
                <optgroup label="Inactive / Suspended">
                  {inactiveCustomers.map(c => (
                    <option key={c._id} value={c._id} disabled className="text-gray-400">
                      {c.custCd} — {c.custName} — ₹{Number(c.outstanding || 0).toLocaleString('en-IN')} ({c.status})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Selected customer info */}
            {selectedCustomer && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <div><strong>Code:</strong> {selectedCustomer.custCd}</div>
                <div><strong>Name:</strong> {selectedCustomer.custName}</div>
                <div><strong>Outstanding:</strong> ₹{Number(selectedCustomer.outstanding || 0).toLocaleString('en-IN')}</div>
              </div>
            )}
          </div>

          {/* Ship-To selector (always visible when customer is chosen) */}
          {selectedCustomer && (
            <div>
              <label className="block text-sm mb-1">Ship To Address</label>
              <select
                value={shipToChoice}
                onChange={handleShipToChoiceChange}
                className="w-full border rounded px-3 py-2 mb-2"
              >
                {shipToOptions.map(opt => (
                  <option key={opt.key} value={opt.key} disabled={opt.empty}>
                    {opt.label}{opt.empty ? ' (empty)' : ''}
                  </option>
                ))}
              </select>

              <textarea
                readOnly
                value={form.shipToAddress}
                className="w-full border rounded px-3 py-2 bg-gray-50 text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Order Type */}
          <div>
            <label className="block text-sm mb-1">Order Type</label>
            <select
              name="orderType"
              value={form.orderType}
              onChange={handleFormChange}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="Regular">Regular</option>
              <option value="Express">Express</option>
            </select>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  name="productName"
                  value={item.productName}
                  onChange={e => handleItemChange(idx, e)}
                  placeholder="Product"
                  className="flex-1 border rounded px-2 py-1"
                />
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={e => handleItemChange(idx, e)}
                  placeholder="Qty"
                  required
                  className="w-24 border rounded px-2 py-1 text-right"
                />
                <input
                  name="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.rate}
                  onChange={e => handleItemChange(idx, e)}
                  placeholder="Rate"
                  required
                  className="w-28 border rounded px-2 py-1 text-right"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  title="Remove item"
                  className="p-2 rounded border hover:bg-gray-50 disabled:opacity-40"
                  disabled={form.items.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full bg-blue-500 text-white rounded py-2"
          >
            + Add Item
          </button>

          {/* Date + Time Slot */}
          <div>
            <label className="block text-sm mb-1">Delivery Date</label>
            <input
              name="deliveryDate"
              type="date"
              value={form.deliveryDate}
              onChange={handleFormChange}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex space-x-2">
            <div className="w-1/2">
              <label className="block text-sm mb-1">Time From</label>
              <input
                type="time"
                name="deliveryTimeStart"
                value={form.deliveryTimeStart}
                onChange={handleFormChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm mb-1">Time To</label>
              <input
                type="time"
                name="deliveryTimeEnd"
                value={form.deliveryTimeEnd}
                onChange={handleFormChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Quick total */}
          <div className="text-right text-sm text-gray-600">
            <span className="font-medium">Approx. Total: </span>
            ₹{orderTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded"
          >
            {loading ? 'Adding…' : 'Confirm Order'}
          </button>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setShowConfirm(false)} />
          <div className="relative z-10 w-[92%] max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <h4 className="text-lg font-semibold">Confirm Order</h4>
            </div>
            <div className="px-5 py-4 text-sm space-y-2">
              <p>Are you sure you want to create this order?</p>
              {pendingPayload && (
                <div className="bg-gray-50 border rounded p-3 space-y-1">
                  <div><span className="font-medium">Customer:</span> {selectedCustomer?.custCd} — {selectedCustomer?.custName}</div>
                  <div><span className="font-medium">Type:</span> {pendingPayload.orderType}</div>
                  <div><span className="font-medium">Delivery:</span> {pendingPayload.deliveryDate} ({pendingPayload.deliveryTimeSlot})</div>
                  <div className="font-medium">Items:</div>
                  <ul className="list-disc pl-5">
                    {pendingPayload.items.map((it, i) => (
                      <li key={i}>{it.productName} — {it.quantity} × ₹{it.rate}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1"><X size={16}/> Cancel</span>
              </button>
              <button
                onClick={confirmAndPost}
                disabled={loading}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Yes, Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
