import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  UsersIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from 'lucide-react';

/** Small collapsible section */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100"
      >
        <span className="font-semibold">{title}</span>
        {open ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

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

  const [form, setForm]             = useState(initialForm);
  const [depots, setDepots]         = useState([]);
  const [routes, setRoutes]         = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');

  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);
  const [showShip2, setShowShip2]     = useState(false);
  const [editShowShip2, setEditShowShip2] = useState(false);

  // Load lookups & customers
  useEffect(() => {
    (async () => {
      try {
        const [d1, d2, d3, d4] = await Promise.all([
          api.get('/depots'),
          api.get('/routes'),
          api.get('/employees'),
          api.get('/customers')
        ]);
        setDepots(d1.data || []);
        setRoutes(d2.data || []);
        setEmployees(d3.data || []);
        setCustomers(d4.data || []);
      } catch {
        setError('Failed to load data');
      }
    })();
  }, []);

  const filteredCustomers = customers.filter(c =>
    String(c.custName || '').toLowerCase().includes(search.toLowerCase()) ||
    String(c.custCd || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = e => {
    const { name, type, value, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const numericOrUndefined = v => (v === '' || v == null ? undefined : parseInt(v, 10));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/customers', {
        ...form,
        billPin:    numericOrUndefined(form.billPin),
        shipTo1Pin: numericOrUndefined(form.shipTo1Pin),
        shipTo2Pin: numericOrUndefined(form.shipTo2Pin),
        validity:   form.validity || undefined
      });
      const res = await api.get('/customers');
      setCustomers(res.data || []);
      setForm(initialForm);
      setShowShip2(false);
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete customer');
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
      validity:   c.validity ? String(c.validity).slice(0,10) : ''
    });
    setEditShowShip2(Boolean(c.shipTo2Add1 || c.shipTo2City || c.shipTo2Pin));
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
    e?.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.put(`/customers/${editingId}`, {
        ...editForm,
        billPin:    numericOrUndefined(editForm.billPin),
        shipTo1Pin: numericOrUndefined(editForm.shipTo1Pin),
        shipTo2Pin: numericOrUndefined(editForm.shipTo2Pin),
        validity:   editForm.validity || undefined
      });
      setCustomers(cs => cs.map(c => (c._id === editingId ? res.data : c)));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update customer');
    } finally {
      setEditLoading(false);
    }
  };

  const addressCols = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

  return (
    <div className="p-4 lg:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1500px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Create / Add Customer (scrollable card) */}
        <div className="bg-white rounded-lg shadow flex flex-col max-h-[85vh]">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <UsersIcon size={22}/>
            <h2 className="text-xl font-semibold">Customer Management</h2>
          </div>

          {error && <div className="px-5 pt-3 text-red-600">{error}</div>}

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <Section title="Basic Information" defaultOpen>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Depot</label>
                  <select
                    name="depotCd"
                    value={form.depotCd}
                    onChange={handleChange}
                    required
                    className="w-full border rounded px-3 py-2"
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
                  <label className="block text-sm font-medium mb-1">Customer Code</label>
                  <input
                    name="custCd"
                    value={form.custCd}
                    onChange={handleChange}
                    required
                    maxLength={8}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name</label>
                  <input
                    name="custName"
                    value={form.custName}
                    onChange={handleChange}
                    required
                    maxLength={40}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Employee</label>
                  <select
                    name="empCdMapped"
                    value={form.empCdMapped}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e._id} value={e.empCd}>
                        {e.empCd} — {e.empName || e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Route</label>
                  <select
                    name="routeCdMapped"
                    value={form.routeCdMapped}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select Route</option>
                    {routes.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Billing Address" defaultOpen>
              <div className={addressCols}>
                <input name="billToAdd1" value={form.billToAdd1} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                <input name="billToAdd2" value={form.billToAdd2} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                <input name="billToAdd3" value={form.billToAdd3} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                <input name="billArea"    value={form.billArea}    onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
                <input name="billCity"    value={form.billCity}    onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
                <input name="billPin"     value={form.billPin}     onChange={handleChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                <input name="billStateCd" value={form.billStateCd} onChange={handleChange} maxLength={2} placeholder="State Code" className="border rounded px-3 py-2"/>
              </div>
            </Section>

            <Section title="Shipping Address 1" defaultOpen={false}>
              <div className={addressCols}>
                <input name="shipTo1Add1" value={form.shipTo1Add1} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                <input name="shipTo1Add2" value={form.shipTo1Add2} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                <input name="shipTo1Add3" value={form.shipTo1Add3} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                <input name="shipTo1Area" value={form.shipTo1Area} onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
                <input name="shipTo1City" value={form.shipTo1City} onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
                <input name="shipTo1Pin"  value={form.shipTo1Pin}  onChange={handleChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                <input name="shipTo1StateCd" value={form.shipTo1StateCd} onChange={handleChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
              </div>
            </Section>

            {/* Toggle for Shipping 2 to keep form compact */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Add Shipping Address 2</span>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showShip2} onChange={e => setShowShip2(e.target.checked)} />
                <span className="text-sm">Show</span>
              </label>
            </div>
            {showShip2 && (
              <Section title="Shipping Address 2" defaultOpen={false}>
                <div className={addressCols}>
                  <input name="shipTo2Add1" value={form.shipTo2Add1} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                  <input name="shipTo2Add2" value={form.shipTo2Add2} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                  <input name="shipTo2Add3" value={form.shipTo2Add3} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                  <input name="shipTo2Area" value={form.shipTo2Area} onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
                  <input name="shipTo2City" value={form.shipTo2City} onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
                  <input name="shipTo2Pin"  value={form.shipTo2Pin}  onChange={handleChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                  <input name="shipTo2StateCd" value={form.shipTo2StateCd} onChange={handleChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
                </div>
              </Section>
            )}

            <Section title="Tax & IDs" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input name="custGST"  value={form.custGST}  onChange={handleChange} placeholder="GST No" className="border rounded px-3 py-2"/>
                <input name="custPAN"  value={form.custPAN}  onChange={handleChange} placeholder="PAN / TAN" className="border rounded px-3 py-2"/>
                <input name="custPeso" value={form.custPeso} onChange={handleChange} placeholder="PESO" className="border rounded px-3 py-2"/>
                <input name="tradeLicNo" value={form.tradeLicNo} onChange={handleChange} placeholder="Trade License No" className="border rounded px-3 py-2"/>
              </div>
            </Section>

            <Section title="Status & Contact" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select name="status" value={form.status} onChange={handleChange} className="border rounded px-3 py-2">
                  <option>Active</option><option>Inactive</option><option>Suspended</option>
                </select>
                <select name="agreement" value={form.agreement} onChange={handleChange} className="border rounded px-3 py-2">
                  <option>Yes</option><option>No</option>
                </select>
                <input name="validity" type="date" value={form.validity} onChange={handleChange} className="border rounded px-3 py-2"/>
                <div className="grid grid-cols-2 gap-3">
                  <input name="contactPerson" value={form.contactPerson} onChange={handleChange} placeholder="Contact Person" className="border rounded px-3 py-2"/>
                  <input name="mobileNo" value={form.mobileNo} onChange={handleChange} placeholder="Mobile No" className="border rounded px-3 py-2"/>
                </div>
              </div>
            </Section>
          </form>

          {/* Sticky action bar */}
          <div className="px-5 py-3 border-t bg-white">
            <button
              type="submit"
              form="" // no-op for Safari; we dispatch below
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {loading ? 'Adding…' : <><PlusIcon size={16} className="inline mr-2"/> Add Customer</>}
            </button>
          </div>
        </div>

        {/* Right: Search + Table (own scroll) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-lg font-semibold">Existing Customers</h3>
            <input
              type="text"
              placeholder="Search by name or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border rounded px-3 py-2 w-full sm:w-80"
            />
          </div>

          <div className="bg-white p-3 rounded-lg shadow overflow-auto max-h-[85vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  {['#','Depot','Name','Code','Employee','Route','Billing','Shipping 1','Shipping 2','Tax / IDs','Status / Valid','Contact','Created','Actions']
                    .map((h,i)=>(
                      <th key={i} className="px-2 py-2 text-left text-xs sm:text-sm font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, i) => (
                  <tr key={c._id} className={`${i % 2 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 align-top`}>
                    {editingId === c._id ? (
                      <td colSpan={14} className="px-2 py-3">
                        <form onSubmit={submitEdit} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">Depot</label>
                              <select name="depotCd" value={editForm.depotCd} onChange={handleEditChange} className="w-full border rounded px-3 py-2">
                                <option value="">Select Depot</option>
                                {depots.map(d => (
                                  <option key={d._id} value={d.depotCd}>{d.depotCd} — {d.depotName}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Customer Code</label>
                              <input name="custCd" value={editForm.custCd} onChange={handleEditChange} className="w-full border rounded px-3 py-2"/>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Customer Name</label>
                              <input name="custName" value={editForm.custName} onChange={handleEditChange} className="w-full border rounded px-3 py-2"/>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Employee</label>
                              <select name="empCdMapped" value={editForm.empCdMapped} onChange={handleEditChange} className="w-full border rounded px-3 py-2">
                                <option value="">Select Employee</option>
                                {employees.map(e => (
                                  <option key={e._id} value={e.empCd}>{e.empCd} — {e.empName || e.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium mb-1">Route</label>
                              <select name="routeCdMapped" value={editForm.routeCdMapped} onChange={handleEditChange} className="w-full border rounded px-3 py-2">
                                <option value="">Select Route</option>
                                {routes.map(r => (
                                  <option key={r._id} value={r._id}>{r.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <Section title="Billing Address" defaultOpen={false}>
                            <div className={addressCols}>
                              <input name="billToAdd1" value={editForm.billToAdd1} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                              <input name="billToAdd2" value={editForm.billToAdd2} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                              <input name="billToAdd3" value={editForm.billToAdd3} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                              <input name="billArea" value={editForm.billArea} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
                              <input name="billCity" value={editForm.billCity} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
                              <input name="billPin" value={editForm.billPin} onChange={handleEditChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                              <input name="billStateCd" value={editForm.billStateCd} onChange={handleEditChange} placeholder="State Code" className="border rounded px-3 py-2"/>
                            </div>
                          </Section>

                          <Section title="Shipping Address 1" defaultOpen={false}>
                            <div className={addressCols}>
                              <input name="shipTo1Add1" value={editForm.shipTo1Add1} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                              <input name="shipTo1Add2" value={editForm.shipTo1Add2} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                              <input name="shipTo1Add3" value={editForm.shipTo1Add3} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                              <input name="shipTo1Area" value={editForm.shipTo1Area} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
                              <input name="shipTo1City" value={editForm.shipTo1City} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
                              <input name="shipTo1Pin" value={editForm.shipTo1Pin} onChange={handleEditChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                              <input name="shipTo1StateCd" value={editForm.shipTo1StateCd} onChange={handleEditChange} placeholder="State Code" className="border rounded px-3 py-2"/>
                            </div>
                          </Section>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Edit Shipping Address 2</span>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editShowShip2} onChange={e => setEditShowShip2(e.target.checked)} />
                              <span className="text-sm">Show</span>
                            </label>
                          </div>
                          {editShowShip2 && (
                            <Section title="Shipping Address 2" defaultOpen={false}>
                              <div className={addressCols}>
                                <input name="shipTo2Add1" value={editForm.shipTo2Add1} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                                <input name="shipTo2Add2" value={editForm.shipTo2Add2} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                                <input name="shipTo2Add3" value={editForm.shipTo2Add3} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                                <input name="shipTo2Area" value={editForm.shipTo2Area} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
                                <input name="shipTo2City" value={editForm.shipTo2City} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
                                <input name="shipTo2Pin" value={editForm.shipTo2Pin} onChange={handleEditChange} type="number" placeholder="PIN" className="border rounded px-3 py-2"/>
                                <input name="shipTo2StateCd" value={editForm.shipTo2StateCd} onChange={handleEditChange} placeholder="State Code" className="border rounded px-3 py-2"/>
                              </div>
                            </Section>
                          )}

                          <Section title="Tax & Contact" defaultOpen={false}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input name="custGST" value={editForm.custGST} onChange={handleEditChange} placeholder="GST No" className="border rounded px-3 py-2"/>
                              <input name="custPAN" value={editForm.custPAN} onChange={handleEditChange} placeholder="PAN / TAN" className="border rounded px-3 py-2"/>
                              <input name="custPeso" value={editForm.custPeso} onChange={handleEditChange} placeholder="PESO" className="border rounded px-3 py-2"/>
                              <input name="tradeLicNo" value={editForm.tradeLicNo} onChange={handleEditChange} placeholder="Trade License No" className="border rounded px-3 py-2"/>
                              <select name="status" value={editForm.status} onChange={handleEditChange} className="border rounded px-3 py-2">
                                <option>Active</option><option>Inactive</option><option>Suspended</option>
                              </select>
                              <select name="agreement" value={editForm.agreement} onChange={handleEditChange} className="border rounded px-3 py-2">
                                <option>Yes</option><option>No</option>
                              </select>
                              <input name="validity" type="date" value={editForm.validity} onChange={handleEditChange} className="border rounded px-3 py-2"/>
                              <div className="grid grid-cols-2 gap-3">
                                <input name="contactPerson" value={editForm.contactPerson} onChange={handleEditChange} placeholder="Contact Person" className="border rounded px-3 py-2"/>
                                <input name="mobileNo" value={editForm.mobileNo} onChange={handleEditChange} placeholder="Mobile No" className="border rounded px-3 py-2"/>
                              </div>
                            </div>
                          </Section>

                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancelEdit} disabled={editLoading} className="px-3 py-2 bg-gray-200 rounded flex items-center gap-1">
                              <XIcon size={16}/> Cancel
                            </button>
                            <button type="submit" disabled={editLoading} className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-1">
                              {editLoading ? 'Saving…' : <><SaveIcon size={16}/> Save</>}
                            </button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-2 py-2 text-xs sm:text-sm">{i + 1}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm">{c.depotCd}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm">{c.custName}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm">{c.custCd}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm">{c.empCdMapped}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm">{routes.find(r => r._id === c.routeCdMapped)?.name || '–'}</td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-pre-line">
                          {[c.billToAdd1,c.billToAdd2,c.billToAdd3].filter(Boolean).join('\n')}
                          {`\n${[c.billArea,c.billCity].filter(Boolean).join(', ')}`}
                          {c.billPin ? `\n${c.billPin}, ${c.billStateCd || ''}` : ''}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-pre-line">
                          {[c.shipTo1Add1,c.shipTo1Add2,c.shipTo1Add3].filter(Boolean).join('\n')}
                          {`\n${[c.shipTo1Area,c.shipTo1City].filter(Boolean).join(', ')}`}
                          {c.shipTo1Pin ? `\n${c.shipTo1Pin}, ${c.shipTo1StateCd || ''}` : ''}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-pre-line">
                          {[c.shipTo2Add1,c.shipTo2Add2,c.shipTo2Add3].filter(Boolean).join('\n')}
                          {c.shipTo2Area || c.shipTo2City ? `\n${[c.shipTo2Area,c.shipTo2City].filter(Boolean).join(', ')}` : ''}
                          {c.shipTo2Pin ? `\n${c.shipTo2Pin}, ${c.shipTo2StateCd || ''}` : ''}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-pre-line">
                          {['GST: '+(c.custGST||'—'),'PAN: '+(c.custPAN||'—'),'PESO: '+(c.custPeso||'—'),'Lic: '+(c.tradeLicNo||'—')].join('\n')}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm">
                          {c.status}, {c.agreement}
                          <br/>{c.validity ? new Date(c.validity).toLocaleDateString() : '–'}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-pre-line">
                          {[c.contactPerson, c.mobileNo].filter(Boolean).join('\n')}
                        </td>
                        <td className="px-2 py-2 text-xs sm:text-sm whitespace-nowrap">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-2 flex gap-2">
                          <button onClick={() => startEdit(c)} title="Edit" className="p-1 hover:text-blue-600">
                            <Edit2Icon size={16}/>
                          </button>
                          <button onClick={() => handleDelete(c._id)} title="Delete" className="p-1 hover:text-red-600">
                            <Trash2Icon size={16}/>
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!filteredCustomers.length && (
                  <tr>
                    <td colSpan={14} className="px-2 py-6 text-center text-sm text-gray-500">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
