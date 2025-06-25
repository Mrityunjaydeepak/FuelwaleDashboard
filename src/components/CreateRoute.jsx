import React, { useState, useEffect } from 'react';
import api from '../api';
import { RouteIcon, PlusIcon } from 'lucide-react';

export default function CreateRoute() {
  const initial = { depot: '', name: '' };
  const [form, setForm]       = useState(initial);
  const [depots, setDepots]   = useState([]);
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // 1) Load depots & existing routes
  useEffect(() => {
    api.get('/depots').then(r => setDepots(r.data));
    api.get('/routes').then(r => setRoutes(r.data));
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      // POST exactly { depot: "...", name: "..." }
      await api.post('/routes', form);
      const r = await api.get('/routes');
      setRoutes(r.data);
      setForm(initial);
    } catch (err) {
      console.error('Route create error', err.response || err);
      setError(err.response?.data?.error || 'Failed to create route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <RouteIcon size={24}/> Route Management
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
            <PlusIcon size={20}/> Create New Route
          </h3>

          {error && <div className="text-red-600 mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Depot Dropdown */}
            <div>
              <label className="block mb-1 font-semibold">Depot</label>
              <select
                name="depot"
                value={form.depot}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="">Select Depot</option>
                {depots.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.depotCd} — {d.depotName}
                  </option>
                ))}
              </select>
            </div>

            {/* Route Name */}
            <div>
              <label className="block mb-1 font-semibold">Route Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Downtown Loop"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {loading ? 'Adding…' : 'Add Route'}
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
          <h3 className="text-xl font-medium mb-4">Existing Routes</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left text-sm font-semibold">Depot</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {routes.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    {r.depot.depotCd} — {r.depot.depotName}
                  </td>
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!routes.length && (
                <tr>
                  <td colSpan="3" className="px-4 py-2 text-center text-sm text-gray-500">
                    No routes defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
