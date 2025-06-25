// src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { PencilIcon, PlusCircleIcon, XIcon } from 'lucide-react';

const typeConfigs = {
  A: { label: 'Admin', endpoint: 'users', listKey: 'userId', nameKey: 'userType' },
  E: { label: 'Employee', endpoint: 'employees', listKey: 'empCd', nameKey: 'empName' },
  S: { label: 'Sales Associate', endpoint: 'sales-associates', listKey: 'name', nameKey: 'name' },
  C: { label: 'Customer', endpoint: 'customers', listKey: 'custCd', nameKey: 'custName' },
  D: { label: 'Driver', endpoint: 'drivers', listKey: 'driverCd', nameKey: 'driverName' },
};

export default function UserManagement() {
  const initialForm = {
    userType: '',
    pwd: '',
    userId: '',
    empCd: '',
    empName: '',
    depot: '',
    accessLevel: '',
    saName: '',
    saDepot: '',
    custCd: '',
    custName: '',
    custDepot: '',
    route: '',
    driverCd: '',
    driverName: '',
    driverDepot: ''
  };

  const [form, setForm] = useState(initialForm);
  const [depots, setDepots] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load depots & routes
  useEffect(() => {
    api.get('/depots').then(r => setDepots(r.data)).catch(console.error);
    api.get('/routes').then(r => setRoutes(r.data)).catch(console.error);
  }, []);

  // Reload list on userType
  useEffect(() => {
    if (!form.userType) return setList([]);
    const cfg = typeConfigs[form.userType];
    api.get(`/${cfg.endpoint}`)
      .then(r => setList(r.data))
      .catch(console.error);
  }, [form.userType]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
  };

  const startEdit = item => {
    const type = item.userType;
    let newForm = { ...initialForm, userType: type, pwd: '' };
    switch (type) {
      case 'A':
        newForm.userId = item.userId;
        break;
      case 'E':
        Object.assign(newForm, {
          empCd: item.empCd,
          empName: item.empName,
          depot: item.depot,
          accessLevel: item.accessLevel
        });
        break;
      case 'S':
        Object.assign(newForm, {
          saName: item.name,
          saDepot: item.depot
        });
        break;
      case 'C':
        Object.assign(newForm, {
          custCd: item.custCd,
          custName: item.custName,
          custDepot: item.depotCd,
          route: item.routeCdMapped
        });
        break;
      case 'D':
        Object.assign(newForm, {
          driverCd: item.driverCd,
          driverName: item.driverName,
          driverDepot: item.depot
        });
        break;
      default: break;
    }
    setForm(newForm);
    setEditingId(item._id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const cfg = typeConfigs[form.userType];
    const url = `/${cfg.endpoint}${editingId ? `/${editingId}` : ''}`;
    let payload = {};

    switch (form.userType) {
      case 'A':
        payload = { userId: form.userId, userType: 'A', ...(form.pwd && { pwd: form.pwd }) };
        break;
      case 'E':
        payload = {
          empCd: form.empCd,
          empName: form.empName,
          depot: form.depot,
          accessLevel: form.accessLevel
        };
        break;
      case 'S':
        payload = { name: form.saName, depot: form.saDepot, ...(form.pwd && { pwd: form.pwd }) };
        break;
      case 'C':
        payload = {
          custCd: form.custCd,
          custName: form.custName,
          depotCd: form.custDepot,
          routeCdMapped: form.route
        };
        break;
      case 'D':
        payload = {
          driverCd: form.driverCd,
          driverName: form.driverName,
          depot: form.driverDepot
        };
        break;
      default:
        break;
    }

    try {
      if (editingId) await api.put(url, payload);
      else await api.post(url, payload);
      const r = await api.get(`/${cfg.endpoint}`);
      setList(r.data);
      cancelEdit();
    } catch (err) {
      console.error('API error:', err.response?.data || err.message);
      setError(
        err.response?.data?.error ||
        (err.response?.data?.details ? err.response.data.details.join(', ') : '') ||
        'Save failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async item => {
    const cfg = typeConfigs[form.userType];
    if (!window.confirm(`Delete this ${cfg.label}?`)) return;
    try {
      await api.delete(`/${cfg.endpoint}/${item._id}`);
      const r = await api.get(`/${cfg.endpoint}`);
      setList(r.data);
    } catch (err) {
      console.error('Delete error:', err.response?.data || err.message);
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const renderFormFields = () => {
    switch (form.userType) {
      case 'A': return (
        <>
          <div>
            <label>User ID</label>
            <input name="userId" value={form.userId} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Password {editingId ? '(leave blank)' : ''}</label>
            <input type="password" name="pwd" value={form.pwd} onChange={handleChange}
                   {...(!editingId && { required: true })} className="w-full" />
          </div>
        </>
      );
      case 'E': return (
        <>
          <div>
            <label>Employee Code</label>
            <input name="empCd" value={form.empCd} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Employee Name</label>
            <input name="empName" value={form.empName} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Depot</label>
            <select name="depot" value={form.depot} onChange={handleChange} required className="w-full">
              <option value="">Select Depot</option>
              {depots.map(d => <option key={d._id} value={d._id}>{d.depotCd}</option>)}
            </select>
          </div>
          <div>
            <label>Access Level</label>
            <select name="accessLevel" value={form.accessLevel} onChange={handleChange} required className="w-full">
              <option value="">Select Level</option>
              <option value="1">1 — Order Only</option>
              <option value="2">2 — Order + Logistics</option>
              <option value="3">3 — All Modules</option>
            </select>
          </div>
        </>
      );
      case 'S': return (
        <>
          <div>
            <label>Sales Associate Name</label>
            <input name="saName" value={form.saName} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Depot</label>
            <select name="saDepot" value={form.saDepot} onChange={handleChange} required className="w-full">
              <option value="">Select Depot</option>
              {depots.map(d => <option key={d._id} value={d._id}>{d.depotCd}</option>)}
            </select>
          </div>
          <div>
            <label>Password {editingId ? '(leave blank)' : ''}</label>
            <input type="password" name="pwd" value={form.pwd} onChange={handleChange}
                   {...(!editingId && { required: true })} className="w-full" />
          </div>
        </>
      );
      case 'C': return (
        <>
          <div>
            <label>Customer Code</label>
            <input name="custCd" value={form.custCd} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Customer Name</label>
            <input name="custName" value={form.custName} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Depot</label>
            <select name="custDepot" value={form.custDepot} onChange={handleChange} required className="w-full">
              <option value="">Select Depot</option>
              {depots.map(d => <option key={d._id} value={d._id}>{d.depotCd}</option>)}
            </select>
          </div>
          <div>
            <label>Route</label>
            <select name="route" value={form.route} onChange={handleChange} required className="w-full">
              <option value="">Select Route</option>
              {routes.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
        </>
      );
      case 'D': return (
        <>
          <div>
            <label>Driver Code</label>
            <input name="driverCd" value={form.driverCd} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Driver Name</label>
            <input name="driverName" value={form.driverName} onChange={handleChange} required className="w-full" />
          </div>
          <div>
            <label>Depot</label>
            <select name="driverDepot" value={form.driverDepot} onChange={handleChange} required className="w-full">
              <option value="">Select Depot</option>
              {depots.map(d => <option key={d._id} value={d._id}>{d.depotCd}</option>)}
            </select>
          </div>
        </>
      );
      default:
        return null;
    }
  };

  const renderTable = () => {
    if (!form.userType) return <div>Select a user type...</div>;
    const cfg = typeConfigs[form.userType];
    if (!list.length) return <div>No {cfg.label}s found.</div>;

    return (
      <table className="w-full mt-4 border">
        <thead>
          <tr className="bg-gray-100">
            <th>#</th><th>Key</th><th>Name</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, idx) => (
            <tr key={item._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-1">{idx + 1}</td>
              <td className="px-2 py-1">{item[cfg.listKey]}</td>
              <td className="px-2 py-1">{item[cfg.nameKey]}</td>
              <td className="px-2 py-1 flex space-x-2">
                <button onClick={() => startEdit(item)} className="text-blue-600 hover:underline">
                  <PencilIcon size={16} /> Edit
                </button>
                <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline">
                  <XIcon size={16} /> Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 flex items-center">
        <PlusCircleIcon className="mr-2 text-green-600" size={24} />
        {editingId ? 'Edit' : 'Create'} {typeConfigs[form.userType]?.label || 'User'}
      </h2>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
        <div>
          <label>User Type</label>
          <select name="userType" value={form.userType} onChange={handleChange} required className="w-full border rounded px-2 py-1">
            <option value="">Select Type</option>
            {Object.entries(typeConfigs).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>

        {renderFormFields()}

        <div className="flex space-x-2">
          <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white py-2 rounded">
            {loading ? 'Saving…' : editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="flex-1 bg-gray-300 py-2 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-8">
        <h3 className="text-2xl font-semibold mb-4">Existing {typeConfigs[form.userType]?.label || 'Users'}</h3>
        {renderTable()}
      </div>
    </div>
  );
}

