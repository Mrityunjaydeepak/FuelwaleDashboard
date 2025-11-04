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

/** Minimal modal */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <XIcon size={18}/>
            </button>
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

const MAX_SHIP = 5;
const numericOrUndefined = v => (v === '' || v == null ? undefined : parseInt(v, 10));

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

    // Shipping 1..5 (all fields always visible)
    shipTo1Add1:    '', shipTo1Add2:    '', shipTo1Add3:    '', shipTo1Area:    '', shipTo1City:    '', shipTo1Pin:    '', shipTo1StateCd: '',
    shipTo2Add1:    '', shipTo2Add2:    '', shipTo2Add3:    '', shipTo2Area:    '', shipTo2City:    '', shipTo2Pin:    '', shipTo2StateCd: '',
    shipTo3Add1:    '', shipTo3Add2:    '', shipTo3Add3:    '', shipTo3Area:    '', shipTo3City:    '', shipTo3Pin:    '', shipTo3StateCd: '',
    shipTo4Add1:    '', shipTo4Add2:    '', shipTo4Add3:    '', shipTo4Area:    '', shipTo4City:    '', shipTo4Pin:    '', shipTo4StateCd: '',
    shipTo5Add1:    '', shipTo5Add2:    '', shipTo5Add3:    '', shipTo5Area:    '', shipTo5City:    '', shipTo5Pin:    '', shipTo5StateCd: '',

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

  const [form, setForm]               = useState(initialForm);
  const [depots, setDepots]           = useState([]);
  const [routes, setRoutes]           = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [customers, setCustomers]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  const [openCreate, setOpenCreate]   = useState(false);

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
  const handleEditChange = e => {
    const { name, type, value, checked } = e.target;
    setEditForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/customers', {
        ...form,
        billPin:    numericOrUndefined(form.billPin),
        shipTo1Pin: numericOrUndefined(form.shipTo1Pin),
        shipTo2Pin: numericOrUndefined(form.shipTo2Pin),
        shipTo3Pin: numericOrUndefined(form.shipTo3Pin),
        shipTo4Pin: numericOrUndefined(form.shipTo4Pin),
        shipTo5Pin: numericOrUndefined(form.shipTo5Pin),
        validity:   form.validity || undefined
      });
      const res = await api.get('/customers');
      setCustomers(res.data || []);
      setForm(initialForm);
      setOpenCreate(false);
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
      shipTo3Pin: c.shipTo3Pin?.toString() || '',
      shipTo4Pin: c.shipTo4Pin?.toString() || '',
      shipTo5Pin: c.shipTo5Pin?.toString() || '',
      validity:   c.validity ? String(c.validity).slice(0,10) : ''
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
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
        shipTo3Pin: numericOrUndefined(editForm.shipTo3Pin),
        shipTo4Pin: numericOrUndefined(editForm.shipTo4Pin),
        shipTo5Pin: numericOrUndefined(editForm.shipTo5Pin),
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

  const grid2 = 'grid grid-cols-1 md:grid-cols-2 gap-3';
  const grid3 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  const h = 'text-sm font-semibold mb-2';

  const ShippingBlockCreate = ({ n }) => {
    const p = `shipTo${n}`;
    return (
      <div className="border rounded p-3">
        <div className="text-base font-semibold mb-3">Shipping Address {n}</div>
        <div className={grid3}>
          <input name={`${p}Add1`} value={form[`${p}Add1`]} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
          <input name={`${p}Add2`} value={form[`${p}Add2`]} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
          <input name={`${p}Add3`} value={form[`${p}Add3`]} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
          <input name={`${p}Area`} value={form[`${p}Area`]} onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
          <input name={`${p}City`} value={form[`${p}City`]} onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
          <input name={`${p}Pin`} value={form[`${p}Pin`]} onChange={handleChange} placeholder="PIN" className="border rounded px-3 py-2"/>
          <input name={`${p}StateCd`} value={form[`${p}StateCd`]} onChange={handleChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
        </div>
      </div>
    );
  };

  const ShippingBlockEdit = ({ n }) => {
    const p = `shipTo${n}`;
    return (
      <div className="border rounded p-3">
        <div className="text-base font-semibold mb-3">Shipping Address {n}</div>
        <div className={grid3}>
          <input name={`${p}Add1`} value={editForm[`${p}Add1`]} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
          <input name={`${p}Add2`} value={editForm[`${p}Add2`]} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
          <input name={`${p}Add3`} value={editForm[`${p}Add3`]} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
          <input name={`${p}Area`} value={editForm[`${p}Area`]} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
          <input name={`${p}City`} value={editForm[`${p}City`]} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
          <input name={`${p}Pin`} value={editForm[`${p}Pin`]} onChange={handleEditChange} placeholder="PIN" className="border rounded px-3 py-2"/>
          <input name={`${p}StateCd`} value={editForm[`${p}StateCd`]} onChange={handleEditChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header + Open modal button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon size={22}/>
            <h2 className="text-xl font-semibold">Customer Management</h2>
          </div>
          <button
            onClick={() => { setForm(initialForm); setOpenCreate(true); }}
            className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-1"
          >
            <PlusIcon size={16}/> Add Customer
          </button>
        </div>

        {error && <div className="text-red-600">{error}</div>}

        {/* Customers list (always visible; modal opens on top) */}
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

          <div className="bg-white p-3 rounded-lg shadow overflow-auto max-h-[75vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  {['#','Depot','Name','Code','Employee','Route','Billing','Shipping (all)','Tax / IDs','Status / Valid','Contact','Created','Actions']
                    .map((h,i)=>(
                      <th key={i} className="px-2 py-2 text-left text-xs sm:text-sm font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, i) => (
                  <tr key={c._id} className={`${i % 2 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 align-top`}>
                    {editingId === c._id ? (
                      <td colSpan={13} className="px-2 py-3">
                        <form onSubmit={submitEdit} className="space-y-4">
                          <div>
                            <div className={h}>Basic Information</div>
                            <div className={grid2}>
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
                          </div>

                          <div>
                            <div className={h}>Billing Address</div>
                            <div className={grid3}>
                              <input name="billToAdd1" value={editForm.billToAdd1} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                              <input name="billToAdd2" value={editForm.billToAdd2} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                              <input name="billToAdd3" value={editForm.billToAdd3} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                              <input name="billArea" value={editForm.billArea} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
                              <input name="billCity" value={editForm.billCity} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
                              <input name="billPin" value={editForm.billPin} onChange={handleEditChange} placeholder="PIN" className="border rounded px-3 py-2"/>
                              <input name="billStateCd" value={editForm.billStateCd} onChange={handleEditChange} placeholder="State Code" className="border rounded px-3 py-2"/>
                            </div>
                          </div>

                          {/* Shipping 1..5 (always visible) */}
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className="border rounded p-3">
                              <div className="text-base font-semibold mb-3">Shipping Address {n}</div>
                              <div className={grid3}>
                                <input name={`shipTo${n}Add1`} value={editForm[`shipTo${n}Add1`]} onChange={handleEditChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}Add2`} value={editForm[`shipTo${n}Add2`]} onChange={handleEditChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}Add3`} value={editForm[`shipTo${n}Add3`]} onChange={handleEditChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}Area`} value={editForm[`shipTo${n}Area`]} onChange={handleEditChange} placeholder="Area" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}City`} value={editForm[`shipTo${n}City`]} onChange={handleEditChange} placeholder="City" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}Pin`} value={editForm[`shipTo${n}Pin`]} onChange={handleEditChange} placeholder="PIN" className="border rounded px-3 py-2"/>
                                <input name={`shipTo${n}StateCd`} value={editForm[`shipTo${n}StateCd`]} onChange={handleEditChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
                              </div>
                            </div>
                          ))}

                          <div>
                            <div className={h}>Tax & Contact</div>
                            <div className={grid3}>
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
                              <input name="contactPerson" value={editForm.contactPerson} onChange={handleEditChange} placeholder="Contact Person" className="border rounded px-3 py-2"/>
                              <input name="mobileNo" value={editForm.mobileNo} onChange={handleEditChange} placeholder="Mobile No" className="border rounded px-3 py-2"/>
                            </div>
                          </div>

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
                          {(() => {
                            const blocks = [];
                            for (let k = 1; k <= MAX_SHIP; k++) {
                              const part = [c[`shipTo${k}Add1`], c[`shipTo${k}Add2`], c[`shipTo${k}Add3`]].filter(Boolean).join('\n');
                              const areaCity = [c[`shipTo${k}Area`], c[`shipTo${k}City`]].filter(Boolean).join(', ');
                              const tail = c[`shipTo${k}Pin`] ? `${c[`shipTo${k}Pin`]}, ${c[`shipTo${k}StateCd`] || ''}` : '';
                              const block = [part, areaCity, tail].filter(Boolean).join('\n');
                              if (block.trim()) blocks.push(`(${k})\n${block}`);
                            }
                            return blocks.length ? blocks.join('\n\n') : '—';
                          })()}
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
                    <td colSpan={13} className="px-2 py-6 text-center text-sm text-gray-500">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Add Customer">
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <div className={h}>Basic Information</div>
            <div className={grid2}>
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
          </div>

          <div>
            <div className={h}>Billing Address</div>
            <div className={grid3}>
              <input name="billToAdd1" value={form.billToAdd1} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
              <input name="billToAdd2" value={form.billToAdd2} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
              <input name="billToAdd3" value={form.billToAdd3} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
              <input name="billArea"    value={form.billArea}    onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
              <input name="billCity"    value={form.billCity}    onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
              <input name="billPin"     value={form.billPin}     onChange={handleChange} placeholder="PIN" className="border rounded px-3 py-2"/>
              <input name="billStateCd" value={form.billStateCd} onChange={handleChange} maxLength={2} placeholder="State Code" className="border rounded px-3 py-2"/>
            </div>
          </div>

          {/* Shipping 1..5 (always visible) */}
          {[1,2,3,4,5].map(n => (
            <div key={n} className="border rounded p-3">
              <div className="text-base font-semibold mb-3">Shipping Address {n}</div>
              <div className={grid3}>
                <input name={`shipTo${n}Add1`} value={form[`shipTo${n}Add1`]} onChange={handleChange} placeholder="Address line 1" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}Add2`} value={form[`shipTo${n}Add2`]} onChange={handleChange} placeholder="Address line 2" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}Add3`} value={form[`shipTo${n}Add3`]} onChange={handleChange} placeholder="Address line 3" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}Area`} value={form[`shipTo${n}Area`]} onChange={handleChange} placeholder="Area" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}City`} value={form[`shipTo${n}City`]} onChange={handleChange} placeholder="City" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}Pin`} value={form[`shipTo${n}Pin`]} onChange={handleChange} placeholder="PIN" className="border rounded px-3 py-2"/>
                <input name={`shipTo${n}StateCd`} value={form[`shipTo${n}StateCd`]} onChange={handleChange} placeholder="State Code" maxLength={2} className="border rounded px-3 py-2"/>
              </div>
            </div>
          ))}

          <div>
            <div className={h}>Tax & Contact</div>
            <div className={grid3}>
              <input name="custGST"  value={form.custGST}  onChange={handleChange} placeholder="GST No" className="border rounded px-3 py-2"/>
              <input name="custPAN"  value={form.custPAN}  onChange={handleChange} placeholder="PAN / TAN" className="border rounded px-3 py-2"/>
              <input name="custPeso" value={form.custPeso} onChange={handleChange} placeholder="PESO" className="border rounded px-3 py-2"/>
              <input name="tradeLicNo" value={form.tradeLicNo} onChange={handleChange} placeholder="Trade License No" className="border rounded px-3 py-2"/>
              <select name="status" value={form.status} onChange={handleChange} className="border rounded px-3 py-2">
                <option>Active</option><option>Inactive</option><option>Suspended</option>
              </select>
              <select name="agreement" value={form.agreement} onChange={handleChange} className="border rounded px-3 py-2">
                <option>Yes</option><option>No</option>
              </select>
              <input name="validity" type="date" value={form.validity} onChange={handleChange} className="border rounded px-3 py-2"/>
              <input name="contactPerson" value={form.contactPerson} onChange={handleChange} placeholder="Contact Person" className="border rounded px-3 py-2"/>
              <input name="mobileNo" value={form.mobileNo} onChange={handleChange} placeholder="Mobile No" className="border rounded px-3 py-2"/>
            </div>
          </div>

          {/* Modal footer */}
          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={()=>setOpenCreate(false)} className="px-3 py-2 bg-gray-200 rounded">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-1"
            >
              {loading ? 'Adding…' : <><PlusIcon size={16}/> Add Customer</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
