import React, { useState, useEffect } from 'react';
import api from '../api';
import { ShoppingCart, PlusIcon } from 'lucide-react';

export default function ManageOrders() {
  const initialForm = {
    salesOrderNo: '',
    custCd: '',
    productCd: 'diesel',
    orderQty: '',
    deliveryDate: '',
    deliveryTimeSlot: '',
    orderType: 'regular',
    orderStatus: 'PENDING'
  };
  const [form, setForm] = useState(initialForm);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data));
    fetchOrders();
  }, []);

  const fetchOrders = () => {
    api.get('/orders').then(res => setOrders(res.data));
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      // ensure orderStatus is sent
      await api.post('/orders', form);
      setForm(initialForm);
      fetchOrders();
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
          <input
            name="salesOrderNo"
            value={form.salesOrderNo}
            onChange={handleChange}
            required
            placeholder="Sales Order No"
            className="w-full border rounded px-3 py-2"
          />
          <select
            name="custCd"
            value={form.custCd}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Customer</option>
            {customers.map(c => (
              <option key={c._id} value={c.custCd}>
                {c.custCd} — {c.name}
              </option>
            ))}
          </select>
          {/* Hard-coded product: diesel */}
          <div>
            <label className="block mb-1 font-semibold">Product</label>
            <input
              name="productCd"
              value="diesel"
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>
          <input
            name="orderQty"
            type="number"
            value={form.orderQty}
            onChange={handleChange}
            required
            placeholder="Quantity"
            className="w-full border rounded px-3 py-2"
          />
          <input
            name="deliveryDate"
            type="date"
            value={form.deliveryDate}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
          <input
            name="deliveryTimeSlot"
            value={form.deliveryTimeSlot}
            onChange={handleChange}
            placeholder="Time Slot"
            className="w-full border rounded px-3 py-2"
          />
          <select
            name="orderType"
            value={form.orderType}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          >
            <option value="regular">Regular</option>
            <option value="immediate">Immediate</option>
          </select>
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
