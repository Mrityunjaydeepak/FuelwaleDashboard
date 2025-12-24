// DepotManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Search, X, Home, ArrowLeft, LogOut } from 'lucide-react';

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

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const DEPOTCD_REGEX = /^[0-9]{1,3}$/;
const STATECD_REGEX = /^[0-9]{2}$/;
const CONTACT_REGEX = /^[0-9]{10}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

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
function optionalUpperTrim(s) {
  const t = normalizeUpperTrim(s);
  return t ? t : undefined;
}
function toIntOrUndef(v) {
  const t = normalizeTrim(v);
  if (!t) return undefined;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function friendlyApiError(err) {
  const msg =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    'Save failed';

  // Common Mongo duplicate key patterns: E11000 ... dup key: { field: "value" }
  if (typeof msg === 'string' && msg.includes('E11000')) {
    const fieldMatch = msg.match(/dup key.*\{\s*([a-zA-Z0-9_]+)\s*:/);
    const valMatch = msg.match(/dup key.*:\s*"?([^"}]+)"?\s*\}/);
    const field = fieldMatch?.[1];
    const value = valMatch?.[1];

    if (field) {
      const prettyField =
        {
          depotCd: 'Depot Code',
          depotName: 'Depot Name',
          gstin: 'GSTIN',
          contactNo: 'Contact No.',
          email: 'E-Mail',
        }[field] || field;

      return value
        ? `${prettyField} must be unique. "${value}" already exists.`
        : `${prettyField} must be unique. The value already exists.`;
    }
    return 'Duplicate value detected. One of the unique fields already exists.';
  }

  return msg;
}

export default function DepotManagement() {
  const navigate = useNavigate();

  const initial = {
    depotCd: '',
    depotName: '',

    gstin: '',
    contactNo: '',
    email: '',
    contactName: '',
    status: 'Active', // Backend enum: Active / Inactive

    depotAdd1: '',
    depotAdd2: '',
    depotAdd3: '',
    depotArea: '',
    city: '',
    pin: '',
    stateCd: '',
  };

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('');

  const [form, setForm] = useState(initial);
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = useMemo(() => currentUserType === 'A', [currentUserType]);

  const loadDepots = async () => {
    setListLoading(true);
    try {
      const res = await api.get('/depots');
      setDepots(Array.isArray(res.data) ? res.data : []);
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

    loadDepots().catch(() => setError('Failed to load depots'));
    // eslint-disable-next-line
  }, []);

  const filteredDepots = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return depots;

    return depots.filter(d => {
      const fields = [
        d.depotCd,
        d.depotName,
        d.city,
        d.depotArea,
        d.stateCd,
        d.gstin,
        d.contactNo,
        d.email,
        d.contactName,
        d.status,
        d.pin,
      ].map(x => String(x ?? '').toLowerCase());

      return fields.some(v => v.includes(q));
    });
  }, [depots, searchTerm]);

  const handleChange = e => {
    const { name, value } = e.target;

    const upperFields = new Set(['depotCd', 'stateCd', 'gstin']);
    setForm(f => ({
      ...f,
      [name]: upperFields.has(name) ? value.toUpperCase() : value,
    }));

    setError('');
    setInfo('');
  };

  function validateClient(payload) {
    // Required
    if (!payload.depotCd || !payload.depotName) return 'Depot Code and Depot Name are required';

    // depotCd: up to 3 digits (based on maxlength 3)
    if (!DEPOTCD_REGEX.test(payload.depotCd)) return 'Depot Code must be 1 to 3 digits (e.g., 271)';

    // Optional validations only if provided
    if (payload.stateCd && !STATECD_REGEX.test(payload.stateCd))
      return 'State Code must be 2 digits (e.g., 27)';

    if (payload.gstin && !GSTIN_REGEX.test(payload.gstin)) return 'Invalid GSTIN format';

    if (payload.contactNo && !CONTACT_REGEX.test(payload.contactNo))
      return 'Contact No. must be exactly 10 digits';

    if (payload.email && !EMAIL_REGEX.test(payload.email)) return 'Invalid email format';

    if (payload.pin != null && !Number.isFinite(payload.pin)) return 'PIN must be a valid number';

    // Status must match backend enum
    if (payload.status && !['Active', 'Inactive'].includes(payload.status))
      return 'Status must be Active or Inactive';

    return '';
  }

  const handleAddDepot = async () => {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      // Important: do NOT send empty strings for optional fields, or backend match validators will fail.
      const payload = {
        depotCd: normalizeUpperTrim(form.depotCd),
        depotName: normalizeTrim(form.depotName),

        gstin: optionalUpperTrim(form.gstin),
        contactNo: optionalTrim(form.contactNo),
        email: optionalTrim(form.email)?.toLowerCase(),
        contactName: optionalTrim(form.contactName),
        status: normalizeTrim(form.status) || 'Active',

        depotAdd1: optionalTrim(form.depotAdd1),
        depotAdd2: optionalTrim(form.depotAdd2),
        depotAdd3: optionalTrim(form.depotAdd3),
        depotArea: optionalTrim(form.depotArea),
        city: optionalTrim(form.city),
        pin: toIntOrUndef(form.pin),
        stateCd: optionalUpperTrim(form.stateCd),
      };

      const clientErr = validateClient(payload);
      if (clientErr) {
        setError(clientErr);
        return;
      }

      // Upsert by depotCd (kept from your logic)
      const existing = depots.find(d => normalizeUpperTrim(d.depotCd) === payload.depotCd);

      if (existing) {
        const ok = window.confirm(`Depot "${payload.depotCd}" already exists. Update it?`);
        if (!ok) return;

        await api.put(`/depots/${existing._id}`, payload);
        setInfo(`Updated depot ${payload.depotCd}.`);
      } else {
        await api.post('/depots', payload);
        setInfo(`Created depot ${payload.depotCd}.`);
      }

      await loadDepots();
      setForm(initial);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="py-6">
        <h1 className="text-center text-4xl font-extrabold tracking-wide">DEPOT CREATION</h1>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between border rounded-md px-4 py-3">
          <div className="text-sm">
            <span className="text-gray-700">Welcome, </span>
            <span className="font-semibold">{currentUserId || '—'}</span>
            <span className="text-gray-700">!</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="Home"
              type="button"
            >
              <Home size={16} /> Home
            </button>

            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="Back"
              type="button"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="Log Out"
              type="button"
            >
              <LogOut size={16} /> Log Out
            </button>

            <div className="ml-3 text-sm font-semibold text-red-600">{isAdmin ? 'Admin' : ''}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-lg font-semibold mb-4">DEPOT</div>

        {(error || info) && (
          <div className="mb-4">
            {error && <div className="text-red-600 font-medium">{error}</div>}
            {info && <div className="text-green-700 font-medium">{info}</div>}
          </div>
        )}

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <button
            onClick={handleAddDepot}
            disabled={loading}
            className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
            type="button"
          >
            {loading ? 'Saving…' : 'Add Depot'}
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                setShowSearch(v => !v);
                setSearchTerm('');
              }}
              className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800"
              type="button"
            >
              Search Depot By Code or Name
            </button>

            {showSearch && (
              <div className="relative w-80">
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Type code, name, city, GSTIN, contact…"
                  className="w-full border rounded pl-9 pr-9 py-2"
                />
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
                  title="Clear"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-red-600">Depot Code *</label>
              <input
                name="depotCd"
                value={form.depotCd}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 271"
                maxLength={3}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-red-600">Depot Name *</label>
              <input
                name="depotName"
                value={form.depotName}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Depot Name"
                maxLength={20}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold">GSTIN No.</label>
              <input
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 27ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Contact No.</label>
              <input
                name="contactNo"
                value={form.contactNo}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 9898989878"
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">E-Mail</label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. name@email.com"
                maxLength={254}
                type="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Contact Name</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. Mahesh Jadhav"
                maxLength={30}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold">Address</label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <input
                name="depotAdd1"
                value={form.depotAdd1}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="Add Line 1"
                maxLength={30}
              />
              <input
                name="depotAdd2"
                value={form.depotAdd2}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="Add Line 2"
                maxLength={30}
              />
              <input
                name="depotAdd3"
                value={form.depotAdd3}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="Add Line 3"
                maxLength={30}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
              <input
                name="depotArea"
                value={form.depotArea}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="Area"
                maxLength={30}
              />
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="City"
                maxLength={20}
              />
              <input
                name="pin"
                value={form.pin}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="PIN"
                inputMode="numeric"
              />
              <input
                name="stateCd"
                value={form.stateCd}
                onChange={handleChange}
                className="border rounded px-3 py-2"
                placeholder="State Code (e.g. 27)"
                maxLength={2}
                inputMode="numeric"
              />
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-3 text-sm text-gray-600">
              Note: Creating/updating depots may be restricted to Admin users by the backend.
            </div>
          )}
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="px-4 py-2 font-semibold text-center border-b">All Depot Status</div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2">S/n</th>
                  <th className="px-3 py-2">Depot Name</th>
                  <th className="px-3 py-2">Depot Code</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">PIN</th>
                  <th className="px-3 py-2">GSTIN</th>
                  <th className="px-3 py-2">Contact No.</th>
                  <th className="px-3 py-2">E-Mail</th>
                  <th className="px-3 py-2">Contact Name</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                      Loading depots…
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredDepots.map((d, idx) => (
                      <tr key={d._id} className="border-t hover:bg-gray-50 align-top">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{d.depotName || '—'}</td>
                        <td className="px-3 py-2 font-mono">{d.depotCd || '—'}</td>
                        <td className="px-3 py-2">{d.stateCd || '—'}</td>
                        <td className="px-3 py-2">{d.city || '—'}</td>
                        <td className="px-3 py-2">{d.depotArea || '—'}</td>
                        <td className="px-3 py-2">{d.pin ?? '—'}</td>
                        <td className="px-3 py-2 font-mono">{d.gstin || '—'}</td>
                        <td className="px-3 py-2">{d.contactNo || '—'}</td>
                        <td className="px-3 py-2">{d.email || '—'}</td>
                        <td className="px-3 py-2">{d.contactName || '—'}</td>
                        <td className="px-3 py-2">{d.status || '—'}</td>
                      </tr>
                    ))}

                    {!filteredDepots.length && (
                      <tr>
                        <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                          No depots found.
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
