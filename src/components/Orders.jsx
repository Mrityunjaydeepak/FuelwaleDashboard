import React, { useState, useEffect } from 'react';
import api from '../api';
import { ShoppingCart, PlusIcon } from 'lucide-react';

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

  useEffect(() => {
    api.get('/orders/customers')
      .then(res => setCustomers(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load customers'));
  }, []);

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

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const deliveryTimeSlot = `${form.deliveryTimeStart} - ${form.deliveryTimeEnd}`;

    const payload = {
      customerId: form.customerId,
      shipToAddress: form.shipToAddress,
      orderType: form.orderType,
      items: form.items.map(i => ({
        productName: i.productName,
        quantity: Number(i.quantity),
        rate: Number(i.rate)
      })),
      deliveryDate: form.deliveryDate,
      deliveryTimeSlot
    };

    try {
      await api.post('/orders', payload);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

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
          <select
            name="customerId"
            value={form.customerId}
            onChange={handleFormChange}
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.custCd} — {c.custName}
              </option>
            ))}
          </select>

          <input
            name="shipToAddress"
            value={form.shipToAddress}
            onChange={handleFormChange}
            required
            placeholder="Ship To Address"
            className="w-full border rounded px-3 py-2"
          />

          {/* Order Type Selector */}
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

          {form.items.map((item, idx) => (
            <div key={idx} className="flex space-x-2">
              <input
                name="quantity"
                type="number"
                value={item.quantity}
                onChange={e => handleItemChange(idx, e)}
                placeholder="Qty"
                required
                className="w-1/3 border rounded px-2 py-1"
              />
              <input
                name="rate"
                type="number"
                step="0.01"
                value={item.rate}
                onChange={e => handleItemChange(idx, e)}
                placeholder="Rate"
                required
                className="w-1/3 border rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={addItem}
                className="w-1/3 bg-blue-500 text-white rounded"
              >
                + Add
              </button>
            </div>
          ))}

          <input
            name="deliveryDate"
            type="date"
            value={form.deliveryDate}
            onChange={handleFormChange}
            required
            className="w-full border rounded px-3 py-2"
          />

          <div className="flex space-x-2">
            <input
              type="time"
              name="deliveryTimeStart"
              value={form.deliveryTimeStart}
              onChange={handleFormChange}
              required
              className="w-1/2 border rounded px-3 py-2"
            />
            <input
              type="time"
              name="deliveryTimeEnd"
              value={form.deliveryTimeEnd}
              onChange={handleFormChange}
              required
              className="w-1/2 border rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded"
          >
            {loading ? 'Adding…' : 'Add Order'}
          </button>
        </form>
      </div>
    </div>
  );
}
