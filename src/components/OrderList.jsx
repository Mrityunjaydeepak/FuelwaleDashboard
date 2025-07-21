import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Edit3, Search, Trash2 } from 'lucide-react';

const STATUS_OPTIONS = [
  'PENDING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'CANCELLED'
];

export default function OrdersList() {
  const [orders, setOrders]       = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [error, setError]         = useState(null);
  const navigate                  = useNavigate();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = () => {
    api.get('/orders')
      .then(res => {
        setOrders(res.data);
        setFiltered(sortPendingFirst(res.data));
        setError(null);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          setError('Unauthorized. Please log in.');
        } else if (err.response?.status === 403) {
          setError('Access denied. You do not have permission to view orders.');
        } else {
          setError('Failed to fetch orders. Please try again.');
        }
        setOrders([]);
        setFiltered([]);
      });
  };

  const sortPendingFirst = list =>
    [...list].sort((a, b) =>
      a.orderStatus === 'PENDING' && b.orderStatus !== 'PENDING' ? -1 : 1
    );

  const handleStatusChange = (id, status) => {
    api.put(`/orders/${id}`, { orderStatus: status })
      .then(fetchAll)
      .catch(err => {
        alert('Failed to update status');
        console.error(err);
      });
  };

  const handleDelete = id => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    api.delete(`/orders/${id}`)
      .then(fetchAll)
      .catch(err => {
        alert('Failed to delete order');
        console.error(err);
      });
  };

  // ** NEW **: Fetch order details & navigate to AssignTrip
  const handleAssignTrip = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      navigate('/trip-manager', { state: { order: res.data } });
    } catch (err) {
      console.error(err);
      alert('Failed to load order details for trip assignment');
    }
  };

  // Filter + search
  useEffect(() => {
    let temp = orders;
    if (search) {
      temp = temp.filter(o => o.salesOrderNo?.includes(search));
    }
    if (from) {
      temp = temp.filter(o => new Date(o.createdAt) >= new Date(from));
    }
    if (to) {
      temp = temp.filter(o => new Date(o.createdAt) <= new Date(to));
    }
    setFiltered(sortPendingFirst(temp));
  }, [search, from, to, orders]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-4">Orders Dashboard</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Search & Date Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center border rounded px-2">
              <Search size={16} />
              <input
                placeholder="Search Order No"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-2 py-1 outline-none"
              />
            </div>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>

          {/* Orders Table */}
          <table className="min-w-full bg-white shadow rounded">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2">Order No</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="border px-4 py-2">{o.salesOrderNo}</td>
                  <td className="border px-4 py-2">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border px-4 py-2">{o.custCd}</td>
                  <td className="border px-4 py-2">{o.orderQty}</td>
                  <td className="border px-4 py-2">{o.orderType || 'Regular'}</td>
                  <td className="border px-4 py-2">
                    <select
                      value={o.orderStatus}
                      onChange={e => handleStatusChange(o._id, e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-4 py-2 text-center space-x-2">
                    {/* Assign Trip button */}
                    <button
                      onClick={() => handleAssignTrip(o._id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Assign Trip"
                    >
                      <Edit3 size={16} />
                    </button>

                    {/* Delete Order button */}
                    <button
                      onClick={() => handleDelete(o._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
