import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  UsersIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon
} from 'lucide-react';

export default function CustomerManagement() {
  const initialForm = {
    depotCd:        '',
    custName:       '',
    custCd:         '',
    empCdMapped:    '',
    routeCdMapped:  '',
    billToAdd1:     '',
    billToAdd2:     '',
    billToAdd3:     '',
    billArea:       '',
    billCity:       '',
    billPin:        '',
    billStateCd:    '',
    shipTo1Add1:    '',
    shipTo1Add2:    '',
    shipTo1Add3:    '',
    shipTo1Area:    '',
    shipTo1City:    '',
    shipTo1Pin:     '',
    shipTo1StateCd: '',
    shipTo2Add1:    '',
    shipTo2Add2:    '',
    shipTo2Add3:    '',
    shipTo2Area:    '',
    shipTo2City:    '',
    shipTo2Pin:     '',
    shipTo2StateCd: '',
    custGST:        '',
    custPAN:        '',
    custPeso:       '',
    tradeLicNo:     '',
    status:         'Active',
    agreement:      'No',
    validity:       '',
    contactPerson:  '',
    mobileNo:       ''
  };

  const [form, setForm]           = useState(initialForm);
  const [depots, setDepots]       = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    api.get('/depots').then(r => setDepots(r.data));
    api.get('/routes').then(r => setRoutes(r.data));
    api.get('/employees').then(r => setEmployees(r.data));
    api.get('/customers').then(r => setCustomers(r.data));
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.custName.toLowerCase().includes(search.toLowerCase()) ||
    c.custCd.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = e => {
    const { name, type, value, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/customers', {
        ...form,
        billPin:    form.billPin    ? parseInt(form.billPin)    : undefined,
        shipTo1Pin: form.shipTo1Pin ? parseInt(form.shipTo1Pin) : undefined,
        shipTo2Pin: form.shipTo2Pin ? parseInt(form.shipTo2Pin) : undefined,
        validity:   form.validity   || undefined
      });
      const res = await api.get('/customers');
      setCustomers(res.data);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      setCustomers(cs => cs.filter(c => c._id !== id));
    } catch {
      alert('Failed to delete customer');
    }
  };

  const startEdit = c => {
    setEditingId(c._id);
    setEditForm({
      ...initialForm,
      ...c,
      billPin:    c.billPin?.toString()    || '',
      shipTo1Pin: c.shipTo1Pin?.toString() || '',
      shipTo2Pin: c.shipTo2Pin?.toString() || '',
      validity:   c.validity?.slice(0,10)  || ''
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const handleEditChange = e => {
    const { name, type, value, checked } = e.target;
    setEditForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const submitEdit = async e => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.put(`/customers/${editingId}`, {
        ...editForm,
        billPin:    editForm.billPin    ? parseInt(editForm.billPin)    : undefined,
        shipTo1Pin: editForm.shipTo1Pin ? parseInt(editForm.shipTo1Pin) : undefined,
        shipTo2Pin: editForm.shipTo2Pin ? parseInt(editForm.shipTo2Pin) : undefined,
        validity:   editForm.validity   || undefined
      });
      setCustomers(cs => cs.map(c => c._id === editingId ? res.data : c));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update customer');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Create Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <UsersIcon size={24}/> Customer Management
        </h2>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Basic Information</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block mb-1 font-semibold">Depot</label>
                <select
                  name="depotCd"
                  value={form.depotCd}
                  onChange={handleChange}
                  required
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Depot</option>
                  {depots.map(d => (
                    <option key={d._id} value={d.depotCd}>
                      {d.depotCd} — {d.depotName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold">Customer Name</label>
                <input
                  name="custName"
                  value={form.custName}
                  onChange={handleChange}
                  required
                  maxLength={20}
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Customer Code</label>
                <input
                  name="custCd"
                  value={form.custCd}
                  onChange={handleChange}
                  required
                  maxLength={8}
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Employee</label>
                <select
                  name="empCdMapped"
                  value={form.empCdMapped}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => (
                    <option key={e._id} value={e.empCd}>
                      {e.empCd} — {e.empName || e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold">Route</label>
                <select
                  name="routeCdMapped"
                  value={form.routeCdMapped}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Route</option>
                  {routes.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Billing Address */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Billing Address</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <input
                name="billToAdd1"
                value={form.billToAdd1}
                onChange={handleChange}
                placeholder="Address line 1"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billToAdd2"
                value={form.billToAdd2}
                onChange={handleChange}
                placeholder="Address line 2"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billToAdd3"
                value={form.billToAdd3}
                onChange={handleChange}
                placeholder="Address line 3"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billArea"
                value={form.billArea}
                onChange={handleChange}
                placeholder="Area"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billCity"
                value={form.billCity}
                onChange={handleChange}
                placeholder="City"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billPin"
                value={form.billPin}
                onChange={handleChange}
                type="number"
                placeholder="PIN"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="billStateCd"
                value={form.billStateCd}
                onChange={handleChange}
                maxLength={2}
                placeholder="State Code"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </fieldset>

          {/* Shipping Address 1 */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Shipping Address 1</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <input
                name="shipTo1Add1"
                value={form.shipTo1Add1}
                onChange={handleChange}
                placeholder="Address line 1"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1Add2"
                value={form.shipTo1Add2}
                onChange={handleChange}
                placeholder="Address line 2"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1Add3"
                value={form.shipTo1Add3}
                onChange={handleChange}
                placeholder="Address line 3"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1Area"
                value={form.shipTo1Area}
                onChange={handleChange}
                placeholder="Area"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1City"
                value={form.shipTo1City}
                onChange={handleChange}
                placeholder="City"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1Pin"
                value={form.shipTo1Pin}
                onChange={handleChange}
                type="number"
                placeholder="PIN"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo1StateCd"
                value={form.shipTo1StateCd}
                onChange={handleChange}
                maxLength={2}
                placeholder="State Code"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </fieldset>

          {/* Shipping Address 2 */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Shipping Address 2</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <input
                name="shipTo2Add1"
                value={form.shipTo2Add1}
                onChange={handleChange}
                placeholder="Address line 1"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2Add2"
                value={form.shipTo2Add2}
                onChange={handleChange}
                placeholder="Address line 2"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2Add3"
                value={form.shipTo2Add3}
                onChange={handleChange}
                placeholder="Address line 3"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2Area"
                value={form.shipTo2Area}
                onChange={handleChange}
                placeholder="Area"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2City"
                value={form.shipTo2City}
                onChange={handleChange}
                placeholder="City"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2Pin"
                value={form.shipTo2Pin}
                onChange={handleChange}
                type="number"
                placeholder="PIN"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="shipTo2StateCd"
                value={form.shipTo2StateCd}
                onChange={handleChange}
                maxLength={2}
                placeholder="State Code"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </fieldset>

          {/* Tax & IDs */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Tax & Identification</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <input
                name="custGST"
                value={form.custGST}
                onChange={handleChange}
                placeholder="GST No"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="custPAN"
                value={form.custPAN}
                onChange={handleChange}
                placeholder="PAN / TAN"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="custPeso"
                value={form.custPeso}
                onChange={handleChange}
                maxLength={30}
                placeholder="PESO"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="tradeLicNo"
                value={form.tradeLicNo}
                onChange={handleChange}
                maxLength={30}
                placeholder="Trade License No"
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </fieldset>

          {/* Status */}
          <fieldset className="border rounded p-4">
            <legend className="px-2 font-semibold">Status & Agreement</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              >
                <option>Active</option>
                <option>Inactive</option>
                <option>Suspended</option>
              </select>
              <select
                name="agreement"
                value={form.agreement}
                onChange={handleChange}
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              >
                <option>Yes</option>
                <option>No</option>
              </select>
              <input
                name="validity"
                type="date"
                value={form.validity}
                onChange={handleChange}
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
              <input
                name="mobileNo"
                placeholder="Contact Mobile"
                value={form.mobileNo}
                onChange={handleChange}
                className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            {loading
              ? 'Adding…'
              : <><PlusIcon size={16} className="inline mr-2"/> Add Customer</>}
          </button>
        </form>
      </div>

      {/* Search + Table */}
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <h3 className="text-xl font-medium">Existing Customers</h3>
        <input
          type="text"
          placeholder="Search by name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 w-full md:w-1/3"
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow overflow-auto max-h-[600px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="px-2 py-2 text-sm font-semibold">#</th>
              <th className="px-2 py-2 text-sm font-semibold">Depot</th>
              <th className="px-2 py-2 text-sm font-semibold">Name</th>
              <th className="px-2 py-2 text-sm font-semibold">Code</th>
              <th className="px-2 py-2 text-sm font-semibold">Employee</th>
              <th className="px-2 py-2 text-sm font-semibold">Route</th>
              <th className="px-2 py-2 text-sm font-semibold">Billing Address</th>
              <th className="px-2 py-2 text-sm font-semibold">Shipping 1</th>
              <th className="px-2 py-2 text-sm font-semibold">Shipping 2</th>
              <th className="px-2 py-2 text-sm font-semibold">Tax / IDs</th>
              <th className="px-2 py-2 text-sm font-semibold">Status / Agree / Valid</th>
              <th className="px-2 py-2 text-sm font-semibold">Contact / Mobile</th>
              <th className="px-2 py-2 text-sm font-semibold">Created</th>
              <th className="px-2 py-2 text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c, i) => (
              <tr
                key={c._id}
                className={`whitespace-nowrap ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
              >
                {editingId === c._id ? (
                  <td colSpan="14" className="px-2 py-4 text-center text-sm">Editing…</td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-sm">{i+1}</td>
                    <td className="px-2 py-2 text-sm">{c.depotCd}</td>
                    <td className="px-2 py-2 text-sm">{c.custName}</td>
                    <td className="px-2 py-2 text-sm">{c.custCd}</td>
                    <td className="px-2 py-2 text-sm">{c.empCdMapped}</td>
                    <td className="px-2 py-2 text-sm">
                      {routes.find(r => r._id===c.routeCdMapped)?.name || '–'}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {c.billToAdd1}<br/>{c.billToAdd2}<br/>{c.billToAdd3}<br/>
                      {c.billArea}, {c.billCity}<br/>
                      {c.billPin}, {c.billStateCd}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {c.shipTo1Add1}<br/>{c.shipTo1Add2}<br/>{c.shipTo1Add3}<br/>
                      {c.shipTo1Area}, {c.shipTo1City}<br/>
                      {c.shipTo1Pin}, {c.shipTo1StateCd}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {c.shipTo2Add1}<br/>{c.shipTo2Add2}<br/>{c.shipTo2Add3}<br/>
                      {c.shipTo2Area}, {c.shipTo2City}<br/>
                      {c.shipTo2Pin}, {c.shipTo2StateCd}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      GST: {c.custGST}<br/>PAN: {c.custPAN}<br/>PESO: {c.custPeso}<br/>Lic: {c.tradeLicNo}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {c.status}, {c.agreement}<br/>{c.validity ? new Date(c.validity).toLocaleDateString() : '–'}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {c.contactPerson}<br/>{c.mobileNo}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 flex gap-2">
                      <button onClick={() => startEdit(c)} title="Edit">
                        <Edit2Icon size={16}/>
                      </button>
                      <button onClick={() => handleDelete(c._id)} title="Delete">
                        <Trash2Icon size={16}/>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!filteredCustomers.length && (
              <tr>
                <td colSpan="14" className="px-2 py-4 text-center text-sm text-gray-500">
                  No customers match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
