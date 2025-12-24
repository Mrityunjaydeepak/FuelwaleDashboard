import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  HomeIcon,
  ArrowLeftIcon,
  LogOutIcon,
  SaveIcon,
  Edit2Icon,
  Trash2Icon,
  SearchIcon,
  XIcon,
  KeyIcon,
  UserIcon
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

const isObjectId = v => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const t = v => String(v ?? '').trim();
const up = v => t(v).toUpperCase();

const STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended'];
const USER_TYPE_OPTIONS = ['E', 'A', 'D', 'S', 'C']; // keep if your backend allows; default in modal is 'E'

export default function EmployeeUsersPage() {
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('');
  const isAdmin = currentUserType === 'A';

  const [userDepotCd, setUserDepotCd] = useState('');

  const [depots, setDepots] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [listLoading, setListLoading] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [credSaving, setCredSaving] = useState(false);

  // ---------------- Employee Form ----------------
  const empInitial = {
    depotId: '',
    depotCd: '',

    empCd: '',
    empName: '',
    contactNo: '',
    email: '',

    // If your Employee schema requires password on create, keep it.
    // This page uses it only for /employees.
    password: '',
  };

  const [empForm, setEmpForm] = useState(empInitial);
  const [editingEmpId, setEditingEmpId] = useState(null);

  // ---------------- Credentials Modal ----------------
  const credInitial = {
    userType: 'E',
    status: 'Active',
    pwd: '',
  };

  const [credOpen, setCredOpen] = useState(false);
  const [credForm, setCredForm] = useState(credInitial);
  const [credTargetEmp, setCredTargetEmp] = useState(null); // employee object
  const [credEditingUserId, setCredEditingUserId] = useState(null); // users._id if exists

  const getDepotCdFromStorage = () => {
    const candidates = [
      localStorage.getItem('depotCd'),
      localStorage.getItem('depot'),
      localStorage.getItem('depotCode'),
      localStorage.getItem('userDepotCd'),
    ];
    const found = candidates.find(v => typeof v === 'string' && v.trim());
    return found ? up(found) : '';
  };

  const loadAll = async () => {
    setListLoading(true);
    try {
      const [dRes, eRes, uRes] = await Promise.all([
        api.get('/depots'),
        api.get('/employees'),
        api.get('/users'),
      ]);
      setDepots(Array.isArray(dRes.data) ? dRes.data : []);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : []);
      setUsers(Array.isArray(uRes.data) ? uRes.data : []);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token');

    const decoded = token ? safeJwtDecode(token) : null;
    setCurrentUserId(decoded?.userId || '');
    setCurrentUserType(decoded?.userType || '');

    setUserDepotCd(getDepotCdFromStorage());

    loadAll().catch(() => setError('Failed to load depots/employees/users'));
    // eslint-disable-next-line
  }, []);

  // ---- depot helpers (to reliably read employee depot regardless of populate) ----
  const depotCodeFromRef = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') {
      if (isObjectId(ref)) {
        const d = depots.find(x => String(x._id) === String(ref));
        return d?.depotCd ? up(d.depotCd) : '';
      }
      return up(ref);
    }
    if (typeof ref === 'object') {
      if (typeof ref.depotCd === 'string' && ref.depotCd.trim()) return up(ref.depotCd);
      const id = ref._id || ref.id;
      if (typeof id === 'string' && isObjectId(id)) {
        const d = depots.find(x => String(x._id) === String(id));
        return d?.depotCd ? up(d.depotCd) : '';
      }
    }
    return '';
  };

  const depotIdFromRef = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') {
      if (isObjectId(ref)) return ref;
      const d = depots.find(x => up(x.depotCd) === up(ref));
      return d?._id || '';
    }
    if (typeof ref === 'object') return ref._id || ref.id || '';
    return '';
  };

  const empDepotCd = (emp) =>
    depotCodeFromRef(emp?.depotCd) ||
    depotCodeFromRef(emp?.depot) ||
    depotCodeFromRef(emp?.depotId) ||
    '';

  const empDepotId = (emp) =>
    depotIdFromRef(emp?.depotCd) ||
    depotIdFromRef(emp?.depot) ||
    depotIdFromRef(emp?.depotId) ||
    '';

  // ---- lock depot for non-admin ----
  useEffect(() => {
    if (!depots.length) return;
    if (isAdmin) return;

    const dc = up(userDepotCd);
    if (!dc) {
      setError('Your depotCd is not in localStorage. Set localStorage.depotCd after login.');
      return;
    }
    const dep = depots.find(d => up(d.depotCd) === dc);
    if (!dep) {
      setError(`Depot ${dc} not found in depot master.`);
      return;
    }
    setEmpForm(f => ({ ...f, depotId: dep._id, depotCd: up(dep.depotCd) }));
    // eslint-disable-next-line
  }, [depots, isAdmin, userDepotCd]);

  // ---- user map: user.userId == employee.empCd ----
  const userByUserId = useMemo(() => {
    const m = new Map();
    for (const u of users) {
      if (u?.userId) m.set(up(u.userId), u);
    }
    return m;
  }, [users]);

  // ---- list visibility ----
  const visibleEmployees = useMemo(() => {
    if (isAdmin) return employees;

    const dc = up(userDepotCd);
    if (!dc) return [];

    return employees.filter(emp => {
      const dep = empDepotCd(emp);
      return dep && up(dep) === dc;
    });
    // eslint-disable-next-line
  }, [employees, isAdmin, userDepotCd, depots]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleEmployees
      .map(emp => ({ emp, user: userByUserId.get(up(emp.empCd)) || null }))
      .filter(({ emp, user }) => {
        if (!q) return true;
        const hay = [
          emp.empCd,
          emp.empName,
          empDepotCd(emp),
          emp.contactNo,
          emp.email,
          user?.userId,
          user?.userType,
          user?.status,
        ].map(x => String(x ?? '').toLowerCase()).join(' ');
        return hay.includes(q);
      });
    // eslint-disable-next-line
  }, [visibleEmployees, userByUserId, search, depots]);

  // ---------------- Top bar logout ----------------
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  // ---------------- Employee form handlers ----------------
  const onEmpChange = (e) => {
    const { name, value } = e.target;
    setError('');
    setInfo('');

    if (name === 'empCd') {
      setEmpForm(f => ({ ...f, empCd: up(value) }));
      return;
    }

    setEmpForm(f => ({ ...f, [name]: value }));
  };

  const onDepotSelect = (depotId) => {
    const dep = depots.find(d => String(d._id) === String(depotId));
    setEmpForm(f => ({ ...f, depotId, depotCd: dep?.depotCd ? up(dep.depotCd) : '' }));
  };

  const resetEmployeeForm = () => {
    setEditingEmpId(null);
    setEmpForm(f => ({
      ...empInitial,
      // keep depot locked for non-admin
      depotId: !isAdmin ? f.depotId : '',
      depotCd: !isAdmin ? f.depotCd : '',
    }));
  };

  const validateEmployee = (f) => {
    if (!f.depotId) return 'Depot is required.';
    if (!t(f.empCd)) return 'Employee Code is required.';
    if (!t(f.empName)) return 'Employee Name is required.';

    // If backend requires employee.password on create:
    if (!editingEmpId && (!t(f.password) || t(f.password).length < 6)) {
      return 'Password is required for Employee (min 6 characters).';
    }
    if (editingEmpId && t(f.password) && t(f.password).length < 6) {
      return 'New password must be at least 6 characters.';
    }

    if (!isAdmin) {
      const dc = up(userDepotCd);
      if (!dc) return 'Your depotCd missing in localStorage.';
      if (up(f.depotCd) !== dc) return 'Non-admin cannot create/update outside own depot.';
    }
    return '';
  };

  // ---- Save employee ONLY (one operation) ----
  const saveEmployeeOnly = async () => {
    setEmpSaving(true);
    setError('');
    setInfo('');
    try {
      // force depot for non-admin
      let depotId = empForm.depotId;
      let depotCd = up(empForm.depotCd);

      if (!isAdmin) {
        const dc = up(userDepotCd);
        const dep = depots.find(d => up(d.depotCd) === dc);
        if (!dep) {
          setError(`Depot ${dc} not found in depot master.`);
          return;
        }
        depotId = dep._id;
        depotCd = up(dep.depotCd);
      }

      const vErr = validateEmployee({ ...empForm, depotId, depotCd });
      if (vErr) {
        setError(vErr);
        return;
      }

      const payload = {
        empCd: up(empForm.empCd),
        empName: t(empForm.empName),

        // compatibility: send id fields the way your backend expects
        depot: depotId || null,
        depotCd: depotId || null,
        depotCode: depotCd,

        contactNo: t(empForm.contactNo) || undefined,
        email: t(empForm.email) || undefined,

        ...(t(empForm.password) ? { password: t(empForm.password) } : {}),
      };

      if (editingEmpId) {
        await api.put(`/employees/${editingEmpId}`, payload);
        setInfo('Employee updated.');
      } else {
        await api.post('/employees', payload);
        setInfo('Employee created.');
      }

      // ✅ refresh list
      await loadAll();

      // ✅ now open credentials popup for this employee
      const empCd = up(empForm.empCd);
      const savedEmp = (employees.find(e => up(e.empCd) === empCd)) || null;

      // loadAll updated employees asynchronously; re-find from fresh list:
      // easiest: find from API again quickly:
      const empRes = await api.get('/employees');
      const empList = Array.isArray(empRes.data) ? empRes.data : [];
      setEmployees(empList);
      const createdEmp = empList.find(e => up(e.empCd) === empCd) || null;

      if (createdEmp) {
        openCredentialsPopup(createdEmp);
      } else {
        // If we cannot find immediately, still open with minimal info
        openCredentialsPopup({
          empCd,
          contactNo: empForm.contactNo,
          depotCd: depotId,
          depotCode: depotCd,
          depot: depotId,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save employee');
    } finally {
      setEmpSaving(false);
    }
  };

  // ---------------- Credentials popup handlers ----------------
  const openCredentialsPopup = (emp) => {
    setError('');
    setInfo('');

    const existingUser = userByUserId.get(up(emp.empCd)) || null;

    setCredTargetEmp(emp);
    setCredEditingUserId(existingUser?._id || null);

    setCredForm({
      userType: existingUser?.userType || 'E',
      status: existingUser?.status || 'Active',
      // require password each time because your backend requires pwd
      pwd: '',
    });

    setCredOpen(true);
  };

  const closeCredentialsPopup = () => {
    setCredOpen(false);
    setCredTargetEmp(null);
    setCredEditingUserId(null);
    setCredForm(credInitial);
  };

  const onCredChange = (e) => {
    const { name, value } = e.target;
    setError('');
    setInfo('');
    setCredForm(f => ({ ...f, [name]: value }));
  };

  const validateCredentials = () => {
    if (!credTargetEmp) return 'No employee selected for credentials.';
    const empCd = up(credTargetEmp.empCd);
    if (!empCd) return 'Employee code is missing.';

    // Required by /users backend
    if (!t(credForm.userType)) return 'User Type is required.';
    if (!t(credForm.pwd)) return 'Password (pwd) is required.';
    if (t(credForm.pwd).length < 6) return 'Password must be at least 6 characters.';

    const mobileNo = t(credTargetEmp.contactNo || empForm.contactNo);
    if (!mobileNo) return 'Contact No. is required for credentials (mobileNo).';

    // depotCd required by backend as string
    let dc = '';
    const fromEmp = empDepotCd(credTargetEmp);
    if (fromEmp) dc = up(fromEmp);
    if (!dc && !isAdmin) dc = up(userDepotCd);
    if (!dc) return 'DepotCd is required for credentials.';

    return '';
  };

  // ---- Save credentials ONLY (one operation) ----
  const saveCredentialsOnly = async () => {
    setCredSaving(true);
    setError('');
    setInfo('');
    try {
      const vErr = validateCredentials();
      if (vErr) {
        setError(vErr);
        return;
      }

      const emp = credTargetEmp;
      const empCd = up(emp.empCd);

      const mobileNo = t(emp.contactNo || empForm.contactNo);

      let depotCd = empDepotCd(emp);
      if (!depotCd && !isAdmin) depotCd = up(userDepotCd);
      depotCd = up(depotCd);

      const userPayload = {
        // Required fields
        userId: empCd,
        empCd: empCd,               // ✅ required for Employee users
        userType: t(credForm.userType),
        pwd: t(credForm.pwd),
        mobileNo: mobileNo,
        depotCd: depotCd,
        status: t(credForm.status) || 'Active',
      };

      // upsert (still one operation: either POST or PUT)
      const existingUser = userByUserId.get(empCd);
      if (credEditingUserId || existingUser?._id) {
        const id = credEditingUserId || existingUser._id;
        await api.put(`/users/${id}`, userPayload);
        setInfo('Credentials updated.');
      } else {
        await api.post('/users', userPayload);
        setInfo('Credentials created.');
      }

      // ✅ refresh list
      await loadAll();

      // Close modal and reset employee form
      closeCredentialsPopup();
      resetEmployeeForm();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save credentials');
    } finally {
      setCredSaving(false);
    }
  };

  // ---------------- Row actions ----------------
  const startEditEmployee = (emp) => {
    setError('');
    setInfo('');

    const depotId = empDepotId(emp);
    const depotCd = empDepotCd(emp);

    setEditingEmpId(emp._id);
    setEmpForm({
      ...empInitial,
      depotId: depotId || '',
      depotCd: depotCd || '',
      empCd: emp.empCd || '',
      empName: emp.empName || '',
      contactNo: emp.contactNo || '',
      email: emp.email || '',
      password: '',
    });
  };

  const deleteEmployeeOnly = async (emp) => {
    if (!window.confirm('Delete this employee? (Credentials will NOT be deleted)')) return;
    setError('');
    setInfo('');
    try {
      await api.delete(`/employees/${emp._id}`);
      await loadAll();
      setInfo('Employee deleted.');
      if (editingEmpId === emp._id) resetEmployeeForm();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to delete employee');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="py-6">
        <h1 className="text-center text-4xl font-extrabold tracking-wide">
          USERS CREATION
        </h1>
        <div className="text-center text-lg font-semibold mt-2">
          Employee first, then Credentials popup
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between border rounded-md px-4 py-3">
          <div className="text-sm">
            <span className="text-gray-700">Welcome, </span>
            <span className="font-semibold">{currentUserId || '—'}</span>
            {!isAdmin && (
              <span className="ml-2 text-gray-700">
                (Depot: <span className="font-semibold">{userDepotCd || '—'}</span>)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
            >
              <HomeIcon size={16} /> Home
            </button>

            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
            >
              <ArrowLeftIcon size={16} /> Back
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              type="button"
            >
              <LogOutIcon size={16} /> Log Out
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

        {/* EMPLOYEE FORM */}
        <div className="border rounded-md p-4 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon size={18} />
            <div className="font-semibold">Employee</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-red-600">Mapped Depot *</label>
              <select
                value={empForm.depotId}
                onChange={e => (isAdmin ? onDepotSelect(e.target.value) : null)}
                className="w-full border rounded px-3 py-2 bg-white"
                disabled={!isAdmin}
              >
                <option value="">Select Depot</option>
                {depots.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.depotCd} — {d.depotName}
                  </option>
                ))}
              </select>
              {!isAdmin && (
                <div className="text-xs text-gray-700 mt-1">
                  Locked to your depot: <b>{userDepotCd || '—'}</b>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-red-600">Employee Code *</label>
              <input
                name="empCd"
                value={empForm.empCd}
                onChange={onEmpChange}
                className="w-full border rounded px-3 py-2"
                placeholder="E123456"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-red-600">Employee Name *</label>
              <input
                name="empName"
                value={empForm.empName}
                onChange={onEmpChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Rahul Patil"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Contact No.</label>
              <input
                name="contactNo"
                value={empForm.contactNo}
                onChange={onEmpChange}
                className="w-full border rounded px-3 py-2"
                placeholder="9898989878"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold">Email</label>
              <input
                name="email"
                value={empForm.email}
                onChange={onEmpChange}
                className="w-full border rounded px-3 py-2"
                placeholder="name@email.com"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-red-600">
                Password {editingEmpId ? '(optional)' : '*'}
              </label>
              <input
                type="password"
                name="password"
                value={empForm.password}
                onChange={onEmpChange}
                className="w-full border rounded px-3 py-2"
                placeholder={editingEmpId ? 'New password (optional)' : 'Required for employee create'}
              />
              <div className="text-xs text-gray-600 mt-1">
                This saves only to <b>/employees</b>. Credentials are created in the popup after saving employee.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            {editingEmpId && (
              <button
                type="button"
                onClick={resetEmployeeForm}
                className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={saveEmployeeOnly}
              disabled={empSaving}
              className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <SaveIcon size={16} />
              {empSaving ? 'Saving…' : (editingEmpId ? 'Update Employee' : 'Save Employee')}
            </button>
          </div>
        </div>

        {/* SEARCH + LIST */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold">All Users Status</div>
          <div className="relative w-full md:w-[520px]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users by Code or Name"
              className="w-full border rounded pl-9 pr-9 py-2"
            />
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
              title="Clear"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2">S/n</th>
                  <th className="px-3 py-2">Emp Code</th>
                  <th className="px-3 py-2">Emp Name</th>
                  <th className="px-3 py-2">Depot</th>
                  <th className="px-3 py-2">User ID</th>
                  <th className="px-3 py-2">User Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredRows.map(({ emp, user }, idx) => (
                      <tr key={emp._id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono">{emp.empCd}</td>
                        <td className="px-3 py-2">{emp.empName}</td>
                        <td className="px-3 py-2">{empDepotCd(emp) || '—'}</td>
                        <td className="px-3 py-2 font-mono">{user?.userId || '—'}</td>
                        <td className="px-3 py-2">{user?.userType || '—'}</td>
                        <td className="px-3 py-2">{user?.status || '—'}</td>
                        <td className="px-3 py-2">{emp.createdAt ? new Date(emp.createdAt).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditEmployee(emp)}
                              className="px-2 py-1 bg-white border rounded hover:bg-gray-100 inline-flex items-center gap-1"
                            >
                              <Edit2Icon size={14} /> Edit Emp
                            </button>

                            <button
                              type="button"
                              onClick={() => openCredentialsPopup(emp)}
                              className="px-2 py-1 bg-blue-700 text-white rounded hover:bg-blue-800 inline-flex items-center gap-1"
                            >
                              <KeyIcon size={14} /> {user ? 'Edit Creds' : 'Create Creds'}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteEmployeeOnly(emp)}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 inline-flex items-center gap-1"
                            >
                              <Trash2Icon size={14} /> Delete Emp
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!filteredRows.length && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                          No employees found.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CREDENTIALS MODAL */}
        {credOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-lg border">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold inline-flex items-center gap-2">
                  <KeyIcon size={18} />
                  Credentials for <span className="font-mono">{up(credTargetEmp?.empCd)}</span>
                </div>
                <button type="button" onClick={closeCredentialsPopup} className="text-gray-600 hover:text-black">
                  <XIcon size={18} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="text-sm text-gray-700">
                  Employee must exist before creating credentials. This popup performs only the credentials operation.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-red-600">User Type *</label>
                    <select
                      name="userType"
                      value={credForm.userType}
                      onChange={onCredChange}
                      className="w-full border rounded px-3 py-2 bg-white"
                    >
                      {USER_TYPE_OPTIONS.map(x => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Status</label>
                    <select
                      name="status"
                      value={credForm.status}
                      onChange={onCredChange}
                      className="w-full border rounded px-3 py-2 bg-white"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-red-600">Password (pwd) *</label>
                  <input
                    type="password"
                    name="pwd"
                    value={credForm.pwd}
                    onChange={onCredChange}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Required by /users"
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    Backend requires: userId, userType, pwd, mobileNo, depotCd, and empCd (for Employee).
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeCredentialsPopup}
                    disabled={credSaving}
                    className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveCredentialsOnly}
                    disabled={credSaving}
                    className="px-6 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <SaveIcon size={16} />
                    {credSaving ? 'Saving…' : (credEditingUserId ? 'Update Credentials' : 'Create Credentials')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}
