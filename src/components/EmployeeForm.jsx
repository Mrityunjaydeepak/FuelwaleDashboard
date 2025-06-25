import React, { useState, useEffect } from 'react';
import api from '../api';

export default function EmployeeForm() {
  const initial = { empCd: '', empName: '', depotCd: '', accessLevel: '' };
  const [form, setForm]   = useState(initial);
  const [depots, setDepots] = useState([]);
  const [error, setError] = useState('');

  // 1) Fetch depots when the component mounts
  useEffect(() => {
    const loadDepots = async () => {
      try {
        const res = await api.get('/depots');
        setDepots(res.data);
      } catch (err) {
        console.error('Failed to load depots', err);
      }
    };
    loadDepots();
  }, []);

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/employees', form);
      alert('Employee created');
      setForm(initial);
    } catch (err) {
      console.error('Employee create error:', err.response || err);
      setError(err.response?.data?.error || 'Failed to create employee');
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow">
      <h3 className="text-lg font-medium mb-4">Create Employee</h3>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Employee Code */}
        <div className="mb-3">
          <label className="block mb-1">Employee Code</label>
          <input
            name="empCd"
            value={form.empCd}
            onChange={handleChange}
            className="w-full border rounded px-2 py-1"
            required
            autoFocus
          />
        </div>

        {/* Employee Name */}
        <div className="mb-3">
          <label className="block mb-1">Employee Name</label>
          <input
            name="empName"
            value={form.empName}
            onChange={handleChange}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>

        {/* Depot Code Dropdown */}
        <div className="mb-3">
          <label className="block mb-1">Depot Code</label>
          <select
            name="depotCd"
            value={form.depotCd}
            onChange={handleChange}
            className="w-full border rounded px-2 py-1"
            required
          >
            <option value="">Select Depot</option>
            {depots.map(d => (
              <option key={d._id} value={d._id}>
                {d.depotCd} — {d.depotName}
              </option>
            ))}
          </select>
        </div>

        {/* Access Level */}
        <div className="mb-3">
          <label className="block mb-1">Access Level</label>
          <input
            name="accessLevel"
            type="number"
            value={form.accessLevel}
            onChange={handleChange}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
