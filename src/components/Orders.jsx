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

  // Which address (Address 1 / Address 2) is selected in the dropdown
  const [shipToChoice, setShipToChoice] = useState(''); // 'shipTo1' | 'shipTo2' | ''

  const selectedCustomer = useMemo(
    () => customers.find(c => String(c._id) === String(form.customerId)) || null,
    [customers, form.customerId]
  );

  // Build Address 1 / Address 2 options from selectedCustomer.shipTo
  const shipToOptions = useMemo(() => {
    if (!selectedCustomer || !Array.isArray(selectedCustomer.shipTo)) return [];
    return selectedCustomer.shipTo.map((addr, idx) => {
      const firstPart = String(addr || '').split(',')[0] || addr || '';
      return {
        key: idx === 0 ? 'shipTo1' : 'shipTo2',
        label: `Address ${idx + 1}: ${firstPart}`,
        value: addr
      };
    });
  }, [selectedCustomer]);

  useEffect(() => {
    let alive = true;
    api.get('/orders/customers')
      .then(res => {
        if (!alive) return;
        setCustomers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load customers'));
    return () => { alive = false; };
  }, []);

  // When customer changes, default Address dropdown & shipToAddress
  useEffect(() => {
    if (!selectedCustomer) {
      setShipToChoice('');
      setForm(f => ({ ...f, shipToAddress: '' }));
      return;
    }
    if (shipToOptions.length > 0) {
      setShipToChoice(shipToOptions[0].key);
      setForm(f => ({ ...f, shipToAddress: shipToOptions[0].value }));
    } else {
      setShipToChoice('');
      setForm(f => ({ ...f, shipToAddress: '' }));
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

  // Build payload + open confirmation
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!form.deliveryDate) {
      setError('Please select a delivery date.');
      return;
    }
    if (!form.deliveryTimeStart || !form.deliveryTimeEnd) {
      setError('Please select a delivery time range.');
      return;
    }
    if (form.deliveryTimeEnd <= form.deliveryTimeStart) {
      setError('Time To must be later than Time From.');
      return;
    }

    const cleanedItems = form.items
      .map(i => ({
        productName: (i.productName || '').trim() || 'diesel',
        quantity: Number(i.quantity),
        rate: Number(i.rate)
      }))
      .filter(i => i.quantity > 0 && i.rate >= 0);

    if (cleanedItems.length === 0) {
      setError('Please add at least one item with a quantity > 0.');
      return;
    }

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
    setShowConfirm(true); // open confirmation modal
  };

  const confirmAndPost = async () => {
    if (!pendingPayload) return;
    setLoading(true);
    try {
      await api.post('/orders', pendingPayload);
      // reset
      setForm(initialForm);
      setShipToChoice('');
      setPendingPayload(null);
      setShowConfirm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists (Active selectable, others greyed)
  const activeCustomers   = customers.filter(c => c.status === 'Active');
  const inactiveCustomers = customers.filter(c => c.status !== 'Active');

  // Handle Address 1/2 dropdown change: update both choice & the actual form.shipToAddress
  const handleShipToChoiceChange = (e) => {
    const key = e.target.value; // 'shipTo1' | 'shipTo2'
    setShipToChoice(key);
    const opt = shipToOptions.find(o => o.key === key);
    setForm(f => ({ ...f, shipToAddress: opt ? opt.value : '' }));
  };

  // Simple total (optional UI cue)
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
          {/* Customer select: Active first (selectable), then greyed non-active */}
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
                    <option
                      key={c._id}
                      value={c._id}
                      disabled
                      className="text-gray-400"
                    >
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

          {/* Ship-To selector */}
          <div>
            <label className="block text-sm mb-1">Ship To Address</label>

            {shipToOptions.length > 0 ? (
              <>
                <select
                  value={shipToChoice}
                  onChange={handleShipToChoiceChange}
                  className="w-full border rounded px-3 py-2 mb-2"
                >
                  {shipToOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>

                <textarea
                  readOnly
                  value={form.shipToAddress}
                  className="w-full border rounded px-3 py-2 bg-gray-50 text-sm"
                  rows={2}
                />
              </>
            ) : (
              <input
                name="shipToAddress"
                value={form.shipToAddress}
                onChange={handleFormChange}
                required
                placeholder="Ship To Address"
                className="w-full border rounded px-3 py-2"
              />
            )}
          </div>

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

          {/* Quick total (optional visual) */}
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
