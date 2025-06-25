import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SalesAssociateForm() {
  const [form, setForm] = useState({ name: '', depot: '', pwd: '' });
  const [depots, setDepots] = useState([]);

  // Fetch list of depots on mount
  useEffect(() => {
    api.get('/depots').then(res => setDepots(res.data));
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/sales-associates', form);
      alert('Sales Associate created');
      setForm({ name: '', depot: '', pwd: '' });
    } catch (err) {
      console.error(err.response?.data || err);
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow">
      <h3 className="text-lg font-medium mb-4">Create Sales Associate</h3>

      {/* Name */}
      <div className="mb-3">
        <label className="block mb-1">Name</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      {/* Depot dropdown */}
      <div className="mb-3">
        <label className="block mb-1">Depot</label>
        <select
          name="depot"
          value={form.depot}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1"
        >
          <option value="">Select Depot</option>
          {depots.map(d => (
            <option key={d._id} value={d._id}>
              {d.depotCd} — {d.depotName}
            </option>
          ))}
        </select>
      </div>

      {/* Password */}
      <div className="mb-3">
        <label className="block mb-1">Password</label>
        <input
          type="password"
          name="pwd"
          value={form.pwd}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Submit
      </button>
    </div>
  );
}
