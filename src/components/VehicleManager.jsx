// VehicleManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  Home,
  ArrowLeft,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function safeJwtDecode(token) {
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const MONTHYEAR_REGEX = /^(0[1-9]|1[0-2])\/\d{4}$/;

function normalizeTrim(s) {
  return String(s ?? '').trim();
}
function normalizeUpperTrim(s) {
  return normalizeTrim(s).toUpperCase();
}
function optionalTrim(s) {
  const t = normalizeTrim(s);
  return t ? t : undefined;
}
function numOrUndef(v) {
  const t = normalizeTrim(v);
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
function toDateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function fmtDate(d) {
  if (!d) return '–';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '–' : dt.toLocaleDateString();
}
function friendlyApiError(err) {
  const msg =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    'Request failed';

  if (typeof msg === 'string' && msg.includes('E11000')) {
    return 'Duplicate value detected. One of the unique fields already exists.';
  }
  return msg;
}

export default function VehicleManagement() {
  const navigate = useNavigate();

  const initialForm = {
    depotCd: '',
    vehicleNo: '',
    make: '',
    model: '',
    capacityLtrs: '',
    calibratedCapacity: '',

    type: 'Oil', // Oil / Diesel / Bitumen
    monthYear: '',
    grossWtMts: '',

    totaliserMake: '',
    totaliserModel: '',

    pesoNo: '',
    pesoValidUpto: '',

    dipStickYesNo: false,
    gpsYesNo: false,
    tankVolumeSensor: false,

    insuranceExpiryDt: '',
    fitnessExpiryDt: '',
    permitExpiryDt: '',
    pollutionExpiryDt: '',

    status: 'Active', // Active / Inactive / Breakdown Maintenance
    remark: '',
  };

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('');
  const [userDepotCd, setUserDepotCd] = useState(''); // from localStorage

  const [form, setForm] = useState(initialForm);
  const [depots, setDepots] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [view, setView] = useState('ALL'); // ALL/ACTIVE/INACTIVE/PAPER/BREAKDOWN
  const [search, setSearch] = useState('');

  const [detailsId, setDetailsId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = useMemo(() => currentUserType === 'A', [currentUserType]);

  // Read user depot from localStorage (you said you'll store it there)
  // Supports multiple possible keys to avoid runtime issues
  const readUserDepotFromStorage = () => {
    const keys = ['depotCd', 'userDepotCd', 'depot', 'userDepot', 'depotCode'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && normalizeTrim(v)) return normalizeUpperTrim(v);
    }
    return '';
  };

  const selectedDepot = useMemo(() => {
    return depots.find(d => String(d.depotCd) === String(form.depotCd)); reminderNullSafe || null;
  }, [depots, form.depotCd]);

  const loadAll = async () => {
    setListLoading(true);
    try {
      const [dRes, vRes] = await Promise.all([api.get('/depots'), api.get('/vehicles')]);
      setDepots(Array.isArray(dRes.data) ? dRes.data : []);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token');

    const payload = token ? safeJwtDecode(token) : null;
    setCurrentUserId(payload?.userId || '');
    setCurrentUserType(payload?.userType || '');

    const depot = readUserDepotFromStorage();
    setUserDepotCd(depot);

    // Pre-fill depot in form for non-admin users
    if (depot) {
      setForm(f => ({ ...f, depotCd: depot }));
    }

    loadAll().catch(() => setError('Failed to load depots/vehicles'));
    // eslint-disable-next-line
  }, []);

  // if localStorage depot changes (rare), you can refresh it manually if needed
  const refreshUserDepot = () => {
    const depot = readUserDepotFromStorage();
    setUserDepotCd(depot);
    if (depot && !isAdmin) setForm(f => ({ ...f, depotCd: depot }));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  const handleChange = e => {
    const { name, type, value, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
    setInfo('');
  };

  const isPaperMaintenance = v => {
    const dates = [v.insuranceExpiryDt, v.fitnessExpiryDt, v.permitExpiryDt, v.pollutionExpiryDt]
      .map(d => (d ? new Date(d) : null))
      .filter(d => d && !Number.isNaN(d.getTime()));

    if (!dates.length) return false;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return dates.some(d => d <= in30);
  };

  // Enforce: non-admin sees only vehicles of their depot
  const visibleVehicles = useMemo(() => {
    if (isAdmin) return vehicles;
    const dep = normalizeUpperTrim(userDepotCd);
    if (!dep) return []; // if depot not present, show none to avoid leakage
    return vehicles.filter(v => normalizeUpperTrim(v.depotCd) === dep);
  }, [vehicles, isAdmin, userDepotCd]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();

    return visibleVehicles
      .filter(v => {
        if (view === 'ACTIVE') return (v.status || 'Active') === 'Active';
        if (view === 'INACTIVE') return (v.status || 'Active') === 'Inactive';
        if (view === 'BREAKDOWN') return (v.status || '') === 'Breakdown Maintenance';
        if (view === 'PAPER') return isPaperMaintenance(v);
        return true;
      })
      .filter(v => {
        if (!q) return true;
        const hay = [v.vehicleNo, v.depotCd, v.make, v.model, v.type, v.status]
          .map(x => String(x ?? '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
  }, [visibleVehicles, view, search]);

  const depotMetaByCd = useMemo(() => {
    const m = new Map();
    depots.forEach(d => m.set(String(d.depotCd), d));
    return m;
  }, [depots]);

  const getGrossMts = v => {
    if (v.grossWtMts != null && v.grossWtMts !== '') return v.grossWtMts;
    if (v.grossWtKgs != null && v.grossWtKgs !== '') {
      const mts = Number(v.grossWtKgs) / 1000;
      return Number.isFinite(mts) ? mts : '–';
    }
    return '–';
  };

  const validateForm = f => {
    // Depot enforcement:
    // - Admin may choose depot
    // - Non-admin depot must match userDepotCd
    if (!f.depotCd) return 'Under Depot is required.';
    if (!isAdmin && normalizeUpperTrim(f.depotCd) !== normalizeUpperTrim(userDepotCd)) {
      return 'You are not allowed to create/update vehicles outside your depot.';
    }

    if (!normalizeTrim(f.vehicleNo)) return 'Vehicle No. is required.';
    if (!normalizeTrim(f.make)) return 'Make is required.';
    if (!normalizeTrim(f.model)) return 'Model is required.';
    if (!normalizeTrim(f.capacityLtrs)) return 'Capacity (Litre) is required.';
    if (!normalizeTrim(f.calibratedCapacity)) return 'Calibrated Capacity (Litre) is required.';
    if (f.monthYear && !MONTHYEAR_REGEX.test(f.monthYear)) return 'Month/Year must be MM/YYYY (e.g., 11/2023).';
    if (!['Oil', 'Diesel', 'Bitumen'].includes(f.type)) return 'Type must be Oil, Diesel, or Bitumen.';
    if (!['Active', 'Inactive', 'Breakdown Maintenance'].includes(f.status))
      return 'Status must be Active, Inactive, or Breakdown Maintenance.';
    return '';
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const vErr = validateForm(form);
      if (vErr) {
        setError(vErr);
        return;
      }

      const grossMts = numOrUndef(form.grossWtMts);
      const payload = {
        vehicleNo: normalizeUpperTrim(form.vehicleNo),
        licensePlate: normalizeUpperTrim(form.vehicleNo),

        depotCd: normalizeUpperTrim(form.depotCd),

        type: form.type,
        make: normalizeTrim(form.make),
        model: normalizeTrim(form.model),
        monthYear: optionalTrim(form.monthYear),

        capacityLtrs: numOrUndef(form.capacityLtrs),
        calibratedCapacity: numOrUndef(form.calibratedCapacity),

        grossWtMts: grossMts,
        grossWtKgs: grossMts != null ? grossMts * 1000 : undefined,

        totaliserMake: optionalTrim(form.totaliserMake),
        totaliserModel: optionalTrim(form.totaliserModel),

        pesoNo: optionalTrim(form.pesoNo),
        pesoValidUpto: form.pesoValidUpto || undefined,

        dipStickYesNo: !!form.dipStickYesNo,
        gpsYesNo: !!form.gpsYesNo,
        tankVolumeSensor: !!form.tankVolumeSensor,

        insuranceExpiryDt: form.insuranceExpiryDt || undefined,
        fitnessExpiryDt: form.fitnessExpiryDt || undefined,
        permitExpiryDt: form.permitExpiryDt || undefined,
        pollutionExpiryDt: form.pollutionExpiryDt || undefined,

        status: form.status,
        remark: optionalTrim(form.remark),
      };

      await api.post('/vehicles', payload);
      const res = await api.get('/vehicles');
      setVehicles(Array.isArray(res.data) ? res.data : []);
      setForm(f => ({
        ...initialForm,
        depotCd: !isAdmin ? normalizeUpperTrim(userDepotCd) : '',
      }));
      setInfo('Vehicle saved.');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this vehicle?')) return;
    setError('');
    setInfo('');
    try {
      await api.delete(`/vehicles/${id}`);
      setVehicles(vs => vs.filter(v => v._id !== id));
      if (editingId === id) setEditingId(null);
      if (detailsId === id) setDetailsId(null);
      setInfo('Vehicle deleted.');
    } catch (err) {
      setError(friendlyApiError(err));
    }
  };

  const startEdit = v => {
    // Enforce: non-admin can only edit within their depot
    if (!isAdmin && normalizeUpperTrim(v.depotCd) !== normalizeUpperTrim(userDepotCd)) {
      setError('You are not allowed to edit vehicles outside your depot.');
      return;
    }

    setEditingId(v._id);
    setEditForm({
      depotCd: v.depotCd || '',
      vehicleNo: v.vehicleNo || '',
      type: v.type || 'Oil',
      make: v.make || '',
      model: v.model || '',
      monthYear: v.monthYear || '',
      capacityLtrs: (v.capacityLtrs ?? '').toString(),
      calibratedCapacity: (v.calibratedCapacity ?? '').toString(),
      grossWtMts:
        v.grossWtMts != null
          ? String(v.grossWtMts)
          : (v.grossWtKgs != null ? String(Number(v.grossWtKgs) / 1000) : ''),
      totaliserMake: v.totaliserMake || '',
      totaliserModel: v.totaliserModel || '',
      pesoNo: v.pesoNo || '',
      pesoValidUpto: toDateInput(v.pesoValidUpto),
      dipStickYesNo: !!v.dipStickYesNo,
      gpsYesNo: !!v.gpsYesNo,
      tankVolumeSensor: !!v.tankVolumeSensor || !!v.volSensor,
      insuranceExpiryDt: toDateInput(v.insuranceExpiryDt),
      fitnessExpiryDt: toDateInput(v.fitnessExpiryDt),
      permitExpiryDt: toDateInput(v.permitExpiryDt),
      pollutionExpiryDt: toDateInput(v.pollutionExpiryDt),
      status: v.status || 'Active',
      remark: v.remark || '',
    });
    setError('');
    setInfo('');
    setDetailsId(v._id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
  };

  const handleEditChange = e => {
    const { name, type, value, checked } = e.target;
    setEditForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const submitEdit = async e => {
    e.preventDefault();
    if (!editingId) return;

    setEditLoading(true);
    setError('');
    setInfo('');

    try {
      const vErr = validateForm(editForm);
      if (vErr) {
        setError(vErr);
        return;
      }

      const grossMts = numOrUndef(editForm.grossWtMts);
      const payload = {
        vehicleNo: normalizeUpperTrim(editForm.vehicleNo),
        licensePlate: normalizeUpperTrim(editForm.vehicleNo),

        depotCd: normalizeUpperTrim(editForm.depotCd),

        type: editForm.type,
        make: normalizeTrim(editForm.make),
        model: normalizeTrim(editForm.model),
        monthYear: optionalTrim(editForm.monthYear),

        capacityLtrs: numOrUndef(editForm.capacityLtrs),
        calibratedCapacity: numOrUndef(editForm.calibratedCapacity),

        grossWtMts: grossMts,
        grossWtKgs: grossMts != null ? grossMts * 1000 : undefined,

        totaliserMake: optionalTrim(editForm.totaliserMake),
        totaliserModel: optionalTrim(editForm.totaliserModel),

        pesoNo: optionalTrim(editForm.pesoNo),
        pesoValidUpto: editForm.pesoValidUpto || undefined,

        dipStickYesNo: !!editForm.dipStickYesNo,
        gpsYesNo: !!editForm.gpsYesNo,
        tankVolumeSensor: !!editForm.tankVolumeSensor,

        insuranceExpiryDt: editForm.insuranceExpiryDt || undefined,
        fitnessExpiryDt: editForm.fitnessExpiryDt || undefined,
        permitExpiryDt: editForm.permitExpiryDt || undefined,
        pollutionExpiryDt: editForm.pollutionExpiryDt || undefined,

        status: editForm.status,
        remark: optionalTrim(editForm.remark),
      };

      const res = await api.put(`/vehicles/${editingId}`, payload);
      setVehicles(vs => vs.map(v => (v._id === editingId ? res.data : v)));
      setInfo('Vehicle updated.');
      cancelEdit();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="py-6">
        <h1 className="text-center text-4xl font-extrabold tracking-wide">VEHICLE CREATION</h1>
        <div className="text-center text-lg font-semibold mt-2">VEHICLE</div>
      </div>

      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between border rounded-md px-4 py-3">
          <div className="text-sm">
            <span className="text-gray-700">Welcome, </span>
            <span className="font-semibold">{currentUserId || '—'}</span>
            <span className="text-gray-700">!</span>
            {!isAdmin && userDepotCd ? (
              <span className="ml-2 text-gray-700">
                (Depot: <span className="font-semibold">{userDepotCd}</span>)
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
              title="Home"
            >
              <Home size={16} /> Home
            </button>

            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
              title="Back"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
              title="Log Out"
            >
              <LogOut size={16} /> Log Out
            </button>

            <button
              onClick={refreshUserDepot}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
              type="button"
              title="Reload depot from localStorage"
            >
              Reload Depot
            </button>

            <div className="ml-3 text-sm font-semibold text-red-600">{isAdmin ? 'Admin' : ''}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {(error || info) && (
          <div>
            {error && <div className="text-red-600 font-medium">{error}</div>}
            {info && <div className="text-green-700 font-medium">{info}</div>}
          </div>
        )}

        {/* Buttons row */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800"
              type="button"
            >
              Add Vehicle
            </button>

            <button onClick={() => setView('ALL')} className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800" type="button">
              View All vehicle
            </button>
            <button onClick={() => setView('ACTIVE')} className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800" type="button">
              Active Vehicle
            </button>
            <button onClick={() => setView('INACTIVE')} className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800" type="button">
              Inactive Vehicle
            </button>
            <button onClick={() => setView('PAPER')} className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800" type="button">
              PaperMaintenance
            </button>
            <button onClick={() => setView('BREAKDOWN')} className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800" type="button">
              Breakdown Maintenance Vehicle
            </button>
          </div>

          <div className="relative w-full md:w-[520px]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Vehicle by code or Vehicle No."
              className="w-full border rounded pl-9 pr-3 py-2"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        {/* Form */}
        <div className="border rounded-md p-4 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={22} />
            <div className="text-xl font-semibold">Vehicle</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Depot / Depot Name / Vehicle / Type / Make / Model */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-red-600">Under Depot *</label>
                <select
                  name="depotCd"
                  value={form.depotCd}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 bg-white"
                  required
                  disabled={!isAdmin} // non-admin locked to their depot
                >
                  <option value="">Select</option>
                  {depots.map(d => (
                    <option key={d._id} value={d.depotCd}>
                      {d.depotCd}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-red-600">Depot Name *</label>
                <input
                  value={selectedDepot?.depotName || ''}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-50"
                  placeholder="Depot Name"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-red-600">Vehicle No. *</label>
                <input
                  name="vehicleNo"
                  value={form.vehicleNo}
                  onChange={e =>
                    handleChange({ target: { name: 'vehicleNo', type: 'text', value: e.target.value.toUpperCase() } })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="MH08BHY9807"
                  maxLength={15}
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold">Type</label>
                <select name="type" value={form.type} onChange={handleChange} className="w-full border rounded px-3 py-2 bg-white">
                  <option value="Oil">Oil</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Bitumen">Bitumen</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-red-600">Make *</label>
                <input name="make" value={form.make} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="TATA" required />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-red-600">Model *</label>
                <input name="model" value={form.model} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="1516" required />
              </div>
            </div>

            {/* Capacity / Calib / Gross / Totaliser / MonthYear */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-red-600">Capacity * (Litre)</label>
                <input name="capacityLtrs" type="number" value={form.capacityLtrs} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="6500" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-red-600">Calibrated Capacity * (Litre)</label>
                <input name="calibratedCapacity" type="number" value={form.calibratedCapacity} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="6000" required />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold">Gross Weight (Mts)</label>
                <input name="grossWtMts" type="number" value={form.grossWtMts} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="20" />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold">Totaliser Make</label>
                <input name="totaliserMake" value={form.totaliserMake} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="Tokheim" />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold">Totaliser Model</label>
                <input name="totaliserModel" value={form.totaliserModel} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="T666" />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold">Month/Year</label>
                <input name="monthYear" value={form.monthYear} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="11/2023" pattern={MONTHYEAR_REGEX.source} />
              </div>
            </div>

            {/* PESO / Equipped / Paper */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-red-600">PESO No. / Valid Upto</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input name="pesoNo" value={form.pesoNo} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="PESO/2222/8990" />
                  <input type="date" name="pesoValidUpto" value={form.pesoValidUpto} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-red-600">Equipped With</label>
                <div className="flex flex-wrap gap-6 mt-2">
                  <label className="inline-flex items-center gap-2">
                    <input name="dipStickYesNo" type="checkbox" checked={form.dipStickYesNo} onChange={handleChange} />
                    Dipstick
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input name="gpsYesNo" type="checkbox" checked={form.gpsYesNo} onChange={handleChange} />
                    GPS
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input name="tankVolumeSensor" type="checkbox" checked={form.tankVolumeSensor} onChange={handleChange} />
                    Tank Volume Sensor
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-red-600">Paper Maintenance</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div>
                    <div className="text-xs font-semibold mb-1">Insurance Expiry</div>
                    <input type="date" name="insuranceExpiryDt" value={form.insuranceExpiryDt} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">Fitness Expiry</div>
                    <input type="date" name="fitnessExpiryDt" value={form.fitnessExpiryDt} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">Permit Expiry</div>
                    <input type="date" name="permitExpiryDt" value={form.permitExpiryDt} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">Pollution Expiry</div>
                    <input type="date" name="pollutionExpiryDt" value={form.pollutionExpiryDt} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Status / Remark / Save */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold">Status</label>
                <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-3 py-2 bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Breakdown Maintenance">Breakdown Maintenance</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-semibold">Remark</label>
                <input name="remark" value={form.remark} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="Remark (optional)" />
              </div>

              <div className="md:col-span-1">
                <button type="submit" disabled={loading} className="w-full px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {loading ? 'Saving…' : <><Plus size={16} /> Save Vehicle</>}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="border rounded-md overflow-hidden bg-purple-100">
          <div className="px-4 py-2 font-semibold text-center border-b">All Vehicle Status</div>

          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead className="bg-purple-100 sticky top-0">
                <tr className="text-left border-b">
                  <th className="px-3 py-2">S/n</th>
                  <th className="px-3 py-2">Vehicle No.</th>
                  <th className="px-3 py-2">Mapped DepotC</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Make</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Month/Year</th>
                  <th className="px-3 py-2">Calib Cap(Litre)</th>
                  <th className="px-3 py-2">Gross Wt.(Mts)</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Remark</th>
                </tr>
              </thead>

              <tbody className="bg-purple-100">
                {listLoading ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-gray-700">
                      Loading vehicles…
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredVehicles.map((v, idx) => {
                      const dep = depotMetaByCd.get(String(v.depotCd));
                      const state = dep?.stateName || dep?.stateCd || '—';
                      const city = dep?.city || '—';

                      const isEditing = editingId === v._id;
                      const showDetails = detailsId === v._id;

                      return (
                        <React.Fragment key={v._id}>
                          <tr className="border-t hover:bg-purple-50 align-top">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono">{v.vehicleNo || '—'}</td>
                            <td className="px-3 py-2">{v.depotCd || '—'}</td>
                            <td className="px-3 py-2">{state}</td>
                            <td className="px-3 py-2">{city}</td>
                            <td className="px-3 py-2">{v.type || '—'}</td>
                            <td className="px-3 py-2">{v.make || '—'}</td>
                            <td className="px-3 py-2">{v.model || '—'}</td>
                            <td className="px-3 py-2">{v.monthYear || '—'}</td>
                            <td className="px-3 py-2">{v.calibratedCapacity ?? '—'}</td>
                            <td className="px-3 py-2">{getGrossMts(v)}</td>
                            <td className="px-3 py-2">{v.status || 'Active'}</td>

                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setDetailsId(showDetails ? null : v._id)}
                                  className="px-2 py-1 bg-white border rounded hover:bg-gray-100 inline-flex items-center gap-1"
                                  type="button"
                                  title="Detailed Arrow"
                                >
                                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  Detailed
                                </button>

                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={submitEdit}
                                      disabled={editLoading}
                                      className="px-2 py-1 bg-blue-700 text-white rounded hover:bg-blue-800 inline-flex items-center gap-1"
                                      type="button"
                                      title="Save"
                                    >
                                      <Save size={14} /> {editLoading ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      disabled={editLoading}
                                      className="px-2 py-1 bg-gray-200 rounded inline-flex items-center gap-1"
                                      type="button"
                                      title="Cancel"
                                    >
                                      <X size={14} /> Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEdit(v)}
                                      className="px-2 py-1 bg-white border rounded hover:bg-gray-100 inline-flex items-center gap-1"
                                      type="button"
                                      title="Edit"
                                    >
                                      <Pencil size={14} /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(v._id)}
                                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 inline-flex items-center gap-1"
                                      type="button"
                                      title="Delete"
                                    >
                                      <Trash2 size={14} /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-2">{v.remark || '—'}</td>
                          </tr>

                          {showDetails && (
                            <tr className="border-t bg-purple-50">
                              <td colSpan={14} className="px-3 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <div className="font-semibold">PESO No. / Valid Upto</div>
                                    <div>{v.pesoNo || '–'}</div>
                                    <div>{fmtDate(v.pesoValidUpto)}</div>
                                  </div>

                                  <div>
                                    <div className="font-semibold">Equipped With</div>
                                    <div>
                                      {v.dipStickYesNo ? 'Dipstick ' : ''}
                                      {v.gpsYesNo ? 'GPS ' : ''}
                                      {(v.tankVolumeSensor || v.volSensor) ? 'Tank Volume Sensor' : ''}
                                      {!v.dipStickYesNo && !v.gpsYesNo && !(v.tankVolumeSensor || v.volSensor) ? '–' : ''}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-semibold">Paper Maintenance</div>
                                    <div>Insurance Expiry: {fmtDate(v.insuranceExpiryDt)}</div>
                                    <div>Fitness Expiry: {fmtDate(v.fitnessExpiryDt)}</div>
                                    <div>Permit Expiry: {fmtDate(v.permitExpiryDt)}</div>
                                    <div>Pollution Expiry: {fmtDate(v.pollutionExpiryDt)}</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {!filteredVehicles.length && (
                      <tr>
                        <td colSpan={14} className="px-3 py-8 text-center text-gray-700">
                          {isAdmin || userDepotCd ? 'No vehicles found.' : 'No depot found in localStorage. Set user depot to view vehicles.'}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
