import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  XIcon,
  SearchIcon,
} from 'lucide-react';

function safeJwtDecode(token) {
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const INDIA_GST_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

const MAX_SHIP = 5;

const numOrUndef = (v) => {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function emptyForm() {
  return {
    depotCd: '',
    custName: '',
    custCd: '',
    adharNo: '',
    emailId: '',
    category: '',
    userType: '',
    mappedSales: '',
    creditPeriodDays: '',
    remark: '',
    empCdMapped: '',
    routeCdMapped: '',
    billToAdd1: '',
    billToAdd2: '',
    billToAdd3: '',
    billArea: '',
    billCity: '',
    billPin: '',
    billState: '',
    billStateCd: '',
    shipTo1Add1: '',
    shipTo1Add2: '',
    shipTo1Add3: '',
    shipTo1Area: '',
    shipTo1City: '',
    shipTo1Pin: '',
    shipTo1StateCd: '',
    shipTo2Add1: '',
    shipTo2Add2: '',
    shipTo2Add3: '',
    shipTo2Area: '',
    shipTo2City: '',
    shipTo2Pin: '',
    shipTo2StateCd: '',
    shipTo3Add1: '',
    shipTo3Add2: '',
    shipTo3Add3: '',
    shipTo3Area: '',
    shipTo3City: '',
    shipTo3Pin: '',
    shipTo3StateCd: '',
    shipTo4Add1: '',
    shipTo4Add2: '',
    shipTo4Add3: '',
    shipTo4Area: '',
    shipTo4City: '',
    shipTo4Pin: '',
    shipTo4StateCd: '',
    shipTo5Add1: '',
    shipTo5Add2: '',
    shipTo5Add3: '',
    shipTo5Area: '',
    shipTo5City: '',
    shipTo5Pin: '',
    shipTo5StateCd: '',
    custGST: '',
    custPAN: '',
    custPeso: '',
    tradeLicNo: '',
    status: 'Active',
    agreement: 'No',
    validity: '',
    contactPerson: '',
    mobileNo: '',
  };
}

function DetailModal({ open, onClose, customer }) {
  if (!open || !customer) return null;

  const blocks = [];
  for (let n = 1; n <= MAX_SHIP; n++) {
    const add = [customer[`shipTo${n}Add1`], customer[`shipTo${n}Add2`], customer[`shipTo${n}Add3`]]
      .filter(Boolean)
      .join(', ');
    const area = customer[`shipTo${n}Area`];
    const city = customer[`shipTo${n}City`];
    const pin = customer[`shipTo${n}Pin`];
    const st = customer[`shipTo${n}StateCd`];
    const line = [add, area, city, pin ? `PIN ${pin}` : '', st ? `StateCd ${st}` : '']
      .filter(Boolean)
      .join(' | ');
    if (line.trim()) blocks.push({ n, line });
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <div className="font-semibold text-gray-800">
              Detailed View — {customer.custName} ({customer.custCd})
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-600"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3 text-sm bg-gray-50/60">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="font-semibold">Depot:</span> {customer.depotCd || '—'}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {customer.status || '—'}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {customer.emailId || '—'}
              </div>
              <div>
                <span className="font-semibold">Mobile:</span> {customer.mobileNo || '—'}
              </div>
              <div>
                <span className="font-semibold">State:</span>{' '}
                {customer.billState || '—'} ({customer.billStateCd || '—'})
              </div>
              <div>
                <span className="font-semibold">Credit Period:</span>{' '}
                {customer.creditPeriodDays ?? '—'}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-white">
              <div className="font-semibold mb-2">Billing</div>
              <div>
                {[customer.billToAdd1, customer.billToAdd2, customer.billToAdd3]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              <div>
                {[customer.billArea, customer.billCity].filter(Boolean).join(', ')}{' '}
                {customer.billPin ? `| PIN ${customer.billPin}` : ''}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-white">
              <div className="font-semibold mb-2">Shipping</div>
              {!blocks.length ? (
                <div>—</div>
              ) : (
                <div className="space-y-2">
                  {blocks.map((b) => (
                    <div key={b.n}>
                      <span className="font-semibold">Shipping {b.n}:</span> {b.line}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3 bg-white">
              <div className="font-semibold mb-2">Tax / IDs</div>
              <div>GSTIN: {customer.custGST || '—'}</div>
              <div>PAN: {customer.custPAN || '—'}</div>
              <div>PESO: {customer.custPeso || '—'}</div>
              <div>Trade Lic: {customer.tradeLicNo || '—'}</div>
            </div>

            <div className="border rounded-lg p-3 bg-white">
              <div className="font-semibold mb-2">Remark</div>
              <div>{customer.remark || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerManagement() {
  const navigate = useNavigate();
  const auth = useAuth?.() || {};
  const logoutFromContext = auth.logout;

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token') ||
    '';

  const decoded = token ? safeJwtDecode(token) : null;
  const currentUserType = decoded?.userType || '';
  const isAdmin = currentUserType === 'A';

  const depotFromStorage = (localStorage.getItem('depotCd') || '')
    .trim()
    .toUpperCase();

  const [form, setForm] = useState(() => {
    const f = emptyForm();
    if (!isAdmin && depotFromStorage) f.depotCd = depotFromStorage;
    return f;
  });

  const [depots, setDepots] = useState([]);
  const [routes, setRoutes] = useState([]); // reserved, even if not used yet
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [shipCount, setShipCount] = useState(1);
  const [mode, setMode] = useState('create');
  const [editingId, setEditingId] = useState(null);

  const [statusTab, setStatusTab] = useState('ALL');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);

  const [formModalOpen, setFormModalOpen] = useState(false);

  const doLogout = async () => {
    try {
      if (typeof logoutFromContext === 'function') {
        await logoutFromContext();
      }
    } catch (_) {
      // ignore
    } finally {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('depotCd');
      } catch (_) {}
      navigate('/login');
    }
  };

  const loadAll = async () => {
    const [d1, d2, d3, d4] = await Promise.all([
      api.get('/depots'),
      api.get('/routes'),
      api.get('/employees'),
      api.get('/customers'),
    ]);
    setDepots(Array.isArray(d1.data) ? d1.data : []);
    setRoutes(Array.isArray(d2.data) ? d2.data : []); // kept for future
    setEmployees(Array.isArray(d3.data) ? d3.data : []);
    setCustomers(Array.isArray(d4.data) ? d4.data : []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch {
        setError('Failed to load data');
      }
    })();
  }, []);

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = customers.filter((c) => {
      if (!isAdmin && depotFromStorage) {
        return String(c.depotCd || '').toUpperCase() === depotFromStorage;
      }
      return true;
    });

    const byStatus = base.filter((c) => {
      if (statusTab === 'ALL') return true;
      return String(c.status || '') === statusTab;
    });

    if (!q) return byStatus;

    return byStatus.filter((c) => {
      const hay = [c.custName, c.custCd, c.depotCd, c.mobileNo, c.emailId, c.custGST].map(
        (v) => String(v || '').toLowerCase()
      );
      return hay.some((x) => x.includes(q));
    });
  }, [customers, search, statusTab, isAdmin, depotFromStorage]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setInfo('');
  };

  const handleBillingStateSelect = (e) => {
    const code = e.target.value;
    const st = INDIA_GST_STATES.find((s) => s.code === code);
    setForm((prev) => ({
      ...prev,
      billStateCd: code,
      billState: st ? st.name : prev.billState,
    }));
    setError('');
    setInfo('');
  };

  const handleShipStateSelect = (shipIndex, e) => {
    const code = e.target.value;
    const key = `shipTo${shipIndex}StateCd`;
    setForm((prev) => ({ ...prev, [key]: code }));
    setError('');
    setInfo('');
  };

  const stateNameFromCode = (code) => {
    const c = String(code || '').trim();
    const st = INDIA_GST_STATES.find((s) => s.code === c);
    return st ? st.name : '';
  };

  const resetToCreate = () => {
    const f = emptyForm();
    if (!isAdmin && depotFromStorage) f.depotCd = depotFromStorage;
    setForm(f);
    setMode('create');
    setEditingId(null);
    setShipCount(1);
    setError('');
    setInfo('');
  };

  const openCreateModal = () => {
    resetToCreate();
    setFormModalOpen(true);
  };

  const startEdit = (c) => {
    const f = emptyForm();
    Object.assign(f, c);
    f.billPin = c.billPin != null ? String(c.billPin) : '';
    f.creditPeriodDays = c.creditPeriodDays != null ? String(c.creditPeriodDays) : '';
    for (let n = 1; n <= MAX_SHIP; n++) {
      const pinKey = `shipTo${n}Pin`;
      f[pinKey] = c[pinKey] != null ? String(c[pinKey]) : '';
    }
    f.validity = c.validity ? toDateInput(c.validity) : '';
    if (!isAdmin && depotFromStorage) f.depotCd = depotFromStorage;
    setForm(f);
    setMode('edit');
    setEditingId(c._id);
    let maxUsed = 1;
    for (let n = 1; n <= MAX_SHIP; n++) {
      const any =
        c[`shipTo${n}Add1`] ||
        c[`shipTo${n}Add2`] ||
        c[`shipTo${n}Add3`] ||
        c[`shipTo${n}Area`] ||
        c[`shipTo${n}City`] ||
        c[`shipTo${n}Pin`] ||
        c[`shipTo${n}StateCd`];
      if (any) maxUsed = n;
    }
    setShipCount(maxUsed);
    setError('');
    setInfo('');
    setFormModalOpen(true);
  };

  const buildPayload = () => {
    const p = { ...form };
    p.depotCd = String(p.depotCd || '').trim();
    p.custName = String(p.custName || '').trim();
    p.custCd = String(p.custCd || '').trim();
    p.emailId = String(p.emailId || '').trim().toLowerCase();
    p.billState = String(p.billState || '').trim();
    p.billStateCd = String(p.billStateCd || '').trim();
    p.billPin = numOrUndef(p.billPin);
    p.creditPeriodDays = numOrUndef(p.creditPeriodDays);
    for (let n = 1; n <= MAX_SHIP; n++) {
      const pinKey = `shipTo${n}Pin`;
      p[pinKey] = numOrUndef(p[pinKey]);
      const stKey = `shipTo${n}StateCd`;
      p[stKey] = String(p[stKey] || '').trim();
    }
    p.validity = p.validity || undefined;
    return p;
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (!form.depotCd || !form.custName || !form.custCd) {
        setError('Mapped Depot, User Name and User Code are required.');
        return;
      }
      const payload = buildPayload();
      if (mode === 'edit' && editingId) {
        await api.put(`/customers/${editingId}`, payload);
        setInfo('Customer updated.');
      } else {
        await api.post('/customers', payload);
        setInfo('Customer created.');
      }
      const r = await api.get('/customers');
      setCustomers(Array.isArray(r.data) ? r.data : []);
      setFormModalOpen(false);
      resetToCreate();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    setError('');
    setInfo('');
    try {
      await api.delete(`/customers/${id}`);
      const r = await api.get('/customers');
      setCustomers(Array.isArray(r.data) ? r.data : []);
      setInfo('Customer deleted.');
      if (editingId === id) resetToCreate();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const inputCls = 'border rounded px-3 py-2 w-full bg-white';
  const labelCls = 'text-xs font-semibold text-gray-800';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Customer Master
            </div>
            <h1 className="text-xl font-bold tracking-wide text-slate-900">
              Customers Creation & Status
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700"
            >
              <PlusIcon size={14} /> New Customer
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
            >
              Home
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={doLogout}
              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 pb-10 pt-4 space-y-4">
        {(error || info) && (
          <div>
            {error && <div className="text-red-700 font-semibold text-sm">{error}</div>}
            {info && <div className="text-green-700 font-semibold text-sm">{info}</div>}
          </div>
        )}

        {/* Status tabs row */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <span className="text-xs font-semibold text-gray-700 mr-2">
            Filter by status:
          </span>
          {[
            { value: 'ALL', label: 'All' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'Suspended', label: 'Suspended' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                statusTab === tab.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Purple list area */}
        <div className="border border-purple-300 bg-purple-50/80 rounded-lg shadow-sm">
          <div className="px-3 py-2 font-semibold text-center border-b border-purple-200 text-purple-900 text-sm">
            View All Customers Status
          </div>

          <div className="px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="font-semibold text-xs text-purple-900">All Customers</div>

            <div className="relative w-full md:w-96">
              <input
                className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, name, mobile, email, GSTIN"
              />
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full text-xs">
              <thead className="bg-purple-100 sticky top-0 z-10 border-b border-purple-200">
                <tr>
                  <th className="px-2 py-2 text-left">Sn</th>
                  <th className="px-2 py-2 text-left">Customer Name</th>
                  <th className="px-2 py-2 text-left">Mapped Depot</th>
                  <th className="px-2 py-2 text-left">Type/Category</th>
                  <th className="px-2 py-2 text-left">User Code</th>
                  <th className="px-2 py-2 text-left">Contact No.</th>
                  <th className="px-2 py-2 text-left">E-Mail</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Remark</th>
                  <th className="px-2 py-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {visibleCustomers.map((c, idx) => (
                  <React.Fragment key={c._id}>
                    <tr className="border-t border-purple-200 bg-purple-50 hover:bg-purple-100/70">
                      <td className="px-2 py-2">{idx + 1}</td>
                      <td className="px-2 py-2 font-medium text-gray-900">
                        {c.custName || '—'}
                      </td>
                      <td className="px-2 py-2">{c.depotCd || '—'}</td>
                      <td className="px-2 py-2">
                        {`${c.userType || '—'} | ${c.category || '—'}`}
                      </td>
                      <td className="px-2 py-2">{c.custCd || '—'}</td>
                      <td className="px-2 py-2">{c.mobileNo || '—'}</td>
                      <td className="px-2 py-2">{c.emailId || '—'}</td>
                      <td className="px-2 py-2">{c.status || '—'}</td>
                      <td className="px-2 py-2">{c.remark || '—'}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setDetailCustomer(c);
                              setDetailOpen(true);
                            }}
                            className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]"
                          >
                            Detailed View
                          </button>
                          <button
                            onClick={() => startEdit(c)}
                            className="px-3 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-[11px]"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Edit2Icon size={14} /> Edit
                            </span>
                          </button>
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 text-[11px]"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Trash2Icon size={14} /> Delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    <tr className="border-t border-purple-200 bg-purple-50/80">
                      <td className="px-2 py-2" colSpan={10}>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-[11px] text-gray-800">
                          <div>
                            <span className="font-semibold">State</span>
                            <br />
                            {c.billState || stateNameFromCode(c.billStateCd) || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">State Cd</span>
                            <br />
                            {c.billStateCd || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">City</span>
                            <br />
                            {c.billCity || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">PIN</span>
                            <br />
                            {c.billPin || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">GSTIN</span>
                            <br />
                            {c.custGST || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">Credit Period (Days)</span>
                            <br />
                            {c.creditPeriodDays ?? '—'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {!visibleCustomers.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-700">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DetailModal
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailCustomer(null);
          }}
          customer={detailCustomer}
        />
      </div>

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loading && setFormModalOpen(false)}
          />
          <div className="relative z-50 w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b bg-white/90 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  {mode === 'edit' ? 'Edit Customer' : 'Create Customer'}
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {form.custName || 'New Customer'}
                </div>
              </div>
              <button
                onClick={() => !loading && setFormModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 bg-gray-50">
              {/* Mapped depot + basic */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-red-600 font-semibold text-xs mb-1">
                    Mapped Depot *
                  </div>
                  <select
                    className={inputCls}
                    name="depotCd"
                    value={form.depotCd}
                    onChange={handleChange}
                    disabled={!isAdmin && !!depotFromStorage}
                  >
                    <option value="">Select</option>
                    {depots.map((d) => (
                      <option key={d._id} value={d.depotCd}>
                        {d.depotCd} — {d.depotName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-red-600 font-semibold text-xs mb-1">
                    User Name *
                  </div>
                  <input
                    className={inputCls}
                    name="custName"
                    value={form.custName}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <div className="text-red-600 font-semibold text-xs mb-1">
                    User Code *
                  </div>
                  <input
                    className={inputCls}
                    name="custCd"
                    value={form.custCd}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <div className={labelCls}>Credit Period (Days)</div>
                  <input
                    className={inputCls}
                    name="creditPeriodDays"
                    value={form.creditPeriodDays}
                    onChange={handleChange}
                    type="number"
                    min="0"
                  />
                </div>
              </div>

              {/* Left billing column */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className={labelCls}>Adhar No</div>
                    <input
                      className={inputCls}
                      name="adharNo"
                      value={form.adharNo}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <div className={labelCls}>Contact No</div>
                    <input
                      className={inputCls}
                      name="mobileNo"
                      value={form.mobileNo}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <div className={labelCls}>Email</div>
                    <input
                      className={inputCls}
                      name="emailId"
                      value={form.emailId}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <div className={labelCls}>Area</div>
                      <input
                        className={inputCls}
                        name="billArea"
                        value={form.billArea}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>City</div>
                      <input
                        className={inputCls}
                        name="billCity"
                        value={form.billCity}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <div className={labelCls}>PIN</div>
                      <input
                        className={inputCls}
                        name="billPin"
                        value={form.billPin}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className={labelCls}>State</div>
                      <select
                        className={inputCls}
                        value={form.billStateCd}
                        onChange={handleBillingStateSelect}
                      >
                        <option value="">Select State</option>
                        {INDIA_GST_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      <input
                        className="mt-2 border rounded px-3 py-2 w-full bg-gray-50"
                        value={form.billState || stateNameFromCode(form.billStateCd)}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, billState: e.target.value }))
                        }
                        placeholder="State Name"
                      />
                    </div>
                  </div>

                  <div>
                    <div className={labelCls}>State Code</div>
                    <input
                      className="border rounded px-3 py-2 w-full bg-gray-50"
                      value={form.billStateCd}
                      readOnly
                    />
                  </div>

                  <div>
                    <div className={labelCls}>Billing Address</div>
                    <input
                      className={inputCls}
                      name="billToAdd1"
                      value={form.billToAdd1}
                      onChange={handleChange}
                      placeholder="Line 1"
                    />
                    <input
                      className={`${inputCls} mt-2`}
                      name="billToAdd2"
                      value={form.billToAdd2}
                      onChange={handleChange}
                      placeholder="Line 2"
                    />
                    <input
                      className={`${inputCls} mt-2`}
                      name="billToAdd3"
                      value={form.billToAdd3}
                      onChange={handleChange}
                      placeholder="Line 3"
                    />
                  </div>
                </div>

                {/* Right columns */}
                <div className="space-y-3 lg:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className={labelCls}>Category (manual)</div>
                      <input
                        className={inputCls}
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>User Type (manual)</div>
                      <input
                        className={inputCls}
                        name="userType"
                        value={form.userType}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>Mapped Sales</div>
                      <input
                        className={inputCls}
                        name="mappedSales"
                        value={form.mappedSales}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className={labelCls}>GSTIN</div>
                      <input
                        className={inputCls}
                        name="custGST"
                        value={form.custGST}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>PAN</div>
                      <input
                        className={inputCls}
                        name="custPAN"
                        value={form.custPAN}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>PESO</div>
                      <input
                        className={inputCls}
                        name="custPeso"
                        value={form.custPeso}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className={labelCls}>Trade Lic No</div>
                      <input
                        className={inputCls}
                        name="tradeLicNo"
                        value={form.tradeLicNo}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>Status</div>
                      <select
                        className={inputCls}
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                    <div>
                      <div className={labelCls}>Agreement</div>
                      <select
                        className={inputCls}
                        name="agreement"
                        value={form.agreement}
                        onChange={handleChange}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className={labelCls}>Validity</div>
                      <input
                        className={inputCls}
                        name="validity"
                        type="date"
                        value={form.validity}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>Contact Person</div>
                      <input
                        className={inputCls}
                        name="contactPerson"
                        value={form.contactPerson}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <div className={labelCls}>Remark</div>
                      <input
                        className={inputCls}
                        name="remark"
                        value={form.remark}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* Shipping details */}
                  <div className="border rounded-lg p-3 bg-white/60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-800">Shipping Details</div>
                      <button
                        type="button"
                        onClick={() => setShipCount((c) => Math.min(MAX_SHIP, c + 1))}
                        disabled={shipCount >= MAX_SHIP}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50"
                      >
                        + Add Shipping
                      </button>
                    </div>

                    <div className="space-y-3">
                      {Array.from({ length: shipCount }).map((_, idx) => {
                        const n = idx + 1;
                        return (
                          <div
                            key={n}
                            className="border rounded-md p-3 bg-white shadow-sm"
                          >
                            <div className="font-semibold mb-2 text-gray-800">
                              Shipping Address {n}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                className={inputCls}
                                name={`shipTo${n}Add1`}
                                value={form[`shipTo${n}Add1`]}
                                onChange={handleChange}
                                placeholder="Address Line 1"
                              />
                              <input
                                className={inputCls}
                                name={`shipTo${n}City`}
                                value={form[`shipTo${n}City`]}
                                onChange={handleChange}
                                placeholder="City"
                              />
                              <input
                                className={inputCls}
                                name={`shipTo${n}Area`}
                                value={form[`shipTo${n}Area`]}
                                onChange={handleChange}
                                placeholder="Area"
                              />
                              <input
                                className={inputCls}
                                name={`shipTo${n}Pin`}
                                value={form[`shipTo${n}Pin`]}
                                onChange={handleChange}
                                placeholder="PIN"
                              />
                              <select
                                className={inputCls}
                                value={form[`shipTo${n}StateCd`]}
                                onChange={(e) => handleShipStateSelect(n, e)}
                              >
                                <option value="">State Code</option>
                                {INDIA_GST_STATES.map((s) => (
                                  <option key={s.code} value={s.code}>
                                    {s.code} — {s.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                className={inputCls}
                                name={`shipTo${n}Add2`}
                                value={form[`shipTo${n}Add2`]}
                                onChange={handleChange}
                                placeholder="Address Line 2"
                              />
                              <input
                                className={inputCls}
                                name={`shipTo${n}Add3`}
                                value={form[`shipTo${n}Add3`]}
                                onChange={handleChange}
                                placeholder="Address Line 3"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loading) {
                          setFormModalOpen(false);
                          resetToCreate();
                        }
                      }}
                      className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-xs"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={loading}
                      className="px-6 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {loading
                        ? 'Saving…'
                        : mode === 'edit'
                        ? 'Update Customer'
                        : 'Save Customer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
