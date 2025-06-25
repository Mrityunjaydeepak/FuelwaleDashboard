import React, { useState, useEffect } from 'react';
import api from '../api';

export default function DepotManagement() {
  const initial = {
    depotCd: '',
    depotName: '',
    depotAdd1: '',
    depotAdd2: '',
    depotAdd3: '',
    depotArea: '',
    city: '',
    pin: '',
    stateCd: ''
  };

  const [form, setForm]     = useState(initial);
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Load existing depots
  useEffect(() => {
    api.get('/depots')
      .then(res => setDepots(res.data))
      .catch(err => console.error('Failed to load depots', err));
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
      await api.post('/depots', form);
      // refresh list
      const res = await api.get('/depots');
      setDepots(res.data);
      setForm(initial);
    } catch (err) {
      console.error('Depot create error', err.response || err);
      setError(err.response?.data?.error || 'Failed to create depot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-6">Depot Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Depot Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-medium mb-4">Create New Depot</h3>
          {error && <div className="text-red-600 mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code & Name */}
              <div>
                <label className="block mb-1 font-semibold">Depot Code</label>
                <input
                  name="depotCd"
                  value={form.depotCd}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="e.g. D01"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Depot Name</label>
                <input
                  name="depotName"
                  value={form.depotName}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Main Depot"
                />
              </div>
            </div>

            {/* Address Group */}
            <fieldset className="border border-gray-200 p-4 rounded">
              <legend className="px-2 font-semibold text-gray-700">Address</legend>
              <div className="space-y-3">
                {['depotAdd1','depotAdd2','depotAdd3'].map((field, idx) => (
                  <input
                    key={field}
                    name={field}
                    value={form[field]}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder={`Address Line ${idx+1}`}
                  />
                ))}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    name="depotArea"
                    value={form.depotArea}
                    onChange={handleChange}
                    placeholder="Area"
                    className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <input
                    name="pin"
                    value={form.pin}
                    onChange={handleChange}
                    placeholder="PIN Code"
                    type="number"
                    className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <input
                  name="stateCd"
                  value={form.stateCd}
                  onChange={handleChange}
                  placeholder="State Code"
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {loading ? 'Creating…' : 'Create Depot'}
            </button>
          </form>
        </div>

        {/* Depot Table */}
        <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
          <h3 className="text-xl font-medium mb-4">Existing Depots</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left text-sm font-semibold">Code</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">City</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">PIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {depots.map(d => (
                <tr key={d._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{d.depotCd}</td>
                  <td className="px-4 py-2 text-sm">{d.depotName}</td>
                  <td className="px-4 py-2 text-sm">{d.city}</td>
                  <td className="px-4 py-2 text-sm">{d.pin}</td>
                </tr>
              ))}
              {depots.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-2 text-center text-sm text-gray-500">
                    No depots yet.
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
