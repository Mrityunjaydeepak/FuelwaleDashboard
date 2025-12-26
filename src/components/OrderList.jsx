// src/components/OrdersList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Edit3, Save, XCircle, Search, RefreshCcw } from 'lucide-react';

const STATUS_OPTIONS = ['PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];

const PRODUCT_MAP = [
  { test: /^(diesel|hsd)$/i, code: '101', name: 'HSD', defaultUom: 'Ltr' },
  { test: /^(petrol|ms)$/i, code: '102', name: 'MS', defaultUom: 'Ltr' },
];

function deriveProductMeta(productName = '') {
  const found = PRODUCT_MAP.find((m) => m.test.test(String(productName)));
  if (!found) return { code: '', name: String(productName || '').toUpperCase(), defaultUom: 'Ltr' };
  return found;
}

function ddmmyyyy(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function yyyymmddInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function todayInput() {
  return yyyymmddInput(new Date());
}

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

function sortPendingFirst(list) {
  const rank = (s) => {
    if (s === 'PENDING') return 0;
    if (s === 'PARTIALLY_COMPLETED') return 1;
    if (s === 'COMPLETED') return 2;
    if (s === 'CANCELLED') return 3;
    return 9;
  };
  return [...list].sort((a, b) => rank(a.orderStatus) - rank(b.orderStatus));
}

function prettyStatus(s) {
  return String(s || 'PENDING').replace(/_/g, ' ');
}

function canModifyWithin12Hours(row) {
  const base = row?.createdAt || row?.dateDely || null;
  if (!base) return true;
  const t = new Date(base).getTime();
  if (!Number.isFinite(t)) return true;
  const diffHrs = (Date.now() - t) / (1000 * 60 * 60);
  return diffHrs <= 12;
}

function readLoggedInUserLabel() {
  try {
    const candidates = [
      () => localStorage.getItem('username'),
      () => localStorage.getItem('userName'),
      () => localStorage.getItem('empCd'),
      () => localStorage.getItem('empCode'),
      () => localStorage.getItem('loggedInUser'),
      () => JSON.parse(localStorage.getItem('user') || 'null')?.empCd,
      () => JSON.parse(localStorage.getItem('user') || 'null')?.userName,
      () => JSON.parse(localStorage.getItem('user') || 'null')?.username,
      () => JSON.parse(localStorage.getItem('auth') || 'null')?.user?.empCd,
      () => JSON.parse(localStorage.getItem('auth') || 'null')?.user?.username,
    ];
    for (const get of candidates) {
      const v = get();
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  } catch {
    // ignore
  }
  return 'User';
}

export default function OrdersList() {
  const [rows, setRows] = useState([]);
  const [rawById, setRawById] = useState({});

  const [searchTop, setSearchTop] = useState('');
  const [searchAssigned, setSearchAssigned] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  const [from, setFrom] = useState(todayInput());
  const [to, setTo] = useState(todayInput());

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState(''); // custCd or custName (normalized key)

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [welcomeName, setWelcomeName] = useState(readLoggedInUserLabel());

  const vehicleById = useMemo(() => {
    const m = {};
    for (const v of vehicles || []) m[String(v._id)] = v;
    return m;
  }, [vehicles]);

  const driverNameById = useMemo(() => {
    const m = {};
    for (const d of drivers || []) m[String(d._id)] = d.driverName || d.profile?.empName || '';
    return m;
  }, [drivers]);

  const customerOptions = useMemo(() => {
    const opts = [];
    const seen = new Set();
    for (const c of customers || []) {
      const cd = String(c?.custCd || '').trim();
      const nm = String(c?.custName || '').trim();
      if (!cd && !nm) continue;
      const label = cd && nm ? `${cd} — ${nm}` : (cd || nm);
      const key = norm(cd || nm);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      opts.push({ key, label, custCd: cd, custName: nm });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [customers]);

  useEffect(() => {
    setWelcomeName(readLoggedInUserLabel());
    fetchAll();
    // eslint-disable-next-line 
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      setError(null);

      const results = await Promise.allSettled([
        api.get('/orders'),
        api.get('/vehicles'),
        api.get('/drivers'),
        api.get('/customers'),
      ]);

      const ordersRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const vehiclesRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const driversRes = results[2].status === 'fulfilled' ? results[2].value : null;
      const customersRes = results[3].status === 'fulfilled' ? results[3].value : null;

      const vArr = Array.isArray(vehiclesRes?.data) ? vehiclesRes.data : [];
      const dArr = Array.isArray(driversRes?.data) ? driversRes.data : [];
      const cArr = Array.isArray(customersRes?.data) ? customersRes.data : [];

      setVehicles(vArr);
      setDrivers(dArr);
      setCustomers(cArr);

      const vById = {};
      const vByNo = {};
      for (const v of vArr) {
        if (v?._id) vById[String(v._id)] = v;
        if (v?.vehicleNo) vByNo[norm(v.vehicleNo)] = v;
      }
      const dNameById = {};
      for (const d of dArr) dNameById[String(d._id)] = d.driverName || d.profile?.empName || '';

      const cById = {};
      const cByCd = {};
      for (const c of cArr) {
        if (c?._id) cById[String(c._id)] = c;
        if (c?.custCd) cByCd[norm(c.custCd)] = c;
      }

      const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const byId = {};
      for (const o of orders) byId[o._id] = o;
      setRawById(byId);

      const flattened = orders.map((o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const first = items[0] || {};
        const meta = deriveProductMeta(first.productName);

        const orderNo =
          typeof o.orderNo === 'string' && o.orderNo ? o.orderNo : (o._id || '').slice(-6);

        const customerObj =
          (o.customer && typeof o.customer === 'object' ? o.customer : null) ||
          (o.customer && typeof o.customer === 'string' ? cById[String(o.customer)] : null) ||
          null;

        const custCd = customerObj?.custCd || '';
        const custName = customerObj?.custName || '';

        const vehicleIdFromOrder =
          typeof o.vehicle === 'string' && o.vehicle ? o.vehicle : o.vehicle?._id || null;

        const vehicleNoFromOrder = o.vehicleRegNo || o.vehicle?.vehicleNo || '';

        const vDoc =
          (vehicleIdFromOrder && vById[String(vehicleIdFromOrder)]) ||
          (vehicleNoFromOrder && vByNo[norm(vehicleNoFromOrder)]) ||
          null;

        const vehicleRegNo = vehicleNoFromOrder || vDoc?.vehicleNo || '';
        const vehicleId = vehicleIdFromOrder || vDoc?._id || null;

        const driverObjFromOrder =
          (o.driver && typeof o.driver === 'object' ? o.driver : null) ||
          (o.vehicle?.driver && typeof o.vehicle.driver === 'object' ? o.vehicle.driver : null);

        const driverIdFromOrder =
          driverObjFromOrder?._id ||
          (o.driver && typeof o.driver === 'string' ? o.driver : null) ||
          (o.vehicle?.driver && typeof o.vehicle.driver === 'string' ? o.vehicle.driver : null);

        const driverId =
          driverIdFromOrder ||
          (vDoc?.driver?._id || (typeof vDoc?.driver === 'string' ? vDoc.driver : null)) ||
          null;

        const driverName =
          driverObjFromOrder?.driverName ||
          vDoc?.driver?.driverName ||
          (driverId ? dNameById[String(driverId)] : '') ||
          o.assignedDriverName ||
          '';

        return {
          _id: o._id,
          orderNo,
          custId: custCd,
          custName,
          shipToLoc: o.shipToAddress || '',
          pdtName: meta.name,
          pdtQty: Number(first.quantity || 0),
          uom: first.uom || meta.defaultUom || 'Ltr',
          dateDely: o.deliveryDate || null,
          timeSlot: o.deliveryTimeSlot || '',
          orderStatus: o.orderStatus || 'PENDING',
          vehicleId,
          vehicleRegNo,
          driverId,
          driverName,
          remarks: o.remarks || o.remark || '',
          createdAt: o.createdAt || null,
          _customerKey: norm(custCd || custName),
        };
      });

      setRows(sortPendingFirst(flattened));
    } catch (err) {
      if (err?.response?.status === 401) setError('Unauthorized. Please log in.');
      else if (err?.response?.status === 403) setError('Access denied.');
      else setError('Failed to load data.');
      setRows([]);
      setVehicles([]);
      setDrivers([]);
      setCustomers([]);
      setRawById({});
    } finally {
      setLoading(false);
    }
  }

  const inDateRange = (row) => {
    const base = row.dateDely || row.createdAt;
    if (!base) return false; // for "today-only" listing, exclude undated rows
    const dt = new Date(base);
    if (Number.isNaN(dt.getTime())) return false;

    if (from) {
      const f = new Date(from);
      if (dt < f) return false;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (dt > end) return false;
    }
    return true;
  };

  const matchesCustomer = (row) => {
    const key = selectedCustomerKey || norm(customerQuery);
    if (!key) return true;
    const rowKey = row._customerKey || norm(row.custId || row.custName);
    if (rowKey && rowKey === key) return true;
    return (
      norm(row.custId).includes(key) ||
      norm(row.custName).includes(key)
    );
  };

  const matchesSearch = (row, s) => {
    if (!s) return true;
    const q = s.trim().toLowerCase();
    return (
      String(row.orderNo || '').toLowerCase().includes(q) ||
      String(row.custId || '').toLowerCase().includes(q) ||
      String(row.custName || '').toLowerCase().includes(q) ||
      String(row.shipToLoc || '').toLowerCase().includes(q) ||
      String(row.pdtName || '').toLowerCase().includes(q) ||
      String(row.vehicleRegNo || '').toLowerCase().includes(q) ||
      String(row.driverName || '').toLowerCase().includes(q)
    );
  };

  const baseToday = useMemo(() => {
    return rows.filter((r) => inDateRange(r) && matchesCustomer(r));
  }, [rows, from, to, selectedCustomerKey, customerQuery]);

  const orderListRows = useMemo(
    () => sortPendingFirst(baseToday.filter((r) => matchesSearch(r, searchTop))),
    [baseToday, searchTop]
  );

  const assignedRows = useMemo(
    () =>
      sortPendingFirst(
        baseToday
          .filter((r) => !!(r.vehicleRegNo || r.driverName))
          .filter((r) => matchesSearch(r, searchAssigned))
      ),
    [baseToday, searchAssigned]
  );

  const statusRows = useMemo(
    () => sortPendingFirst(baseToday.filter((r) => matchesSearch(r, searchStatus))),
    [baseToday, searchStatus]
  );

  const startEdit = (row) => {
    setEditingId(row._id);
    setEditForm({
      shipToLoc: row.shipToLoc,
      pdtQty: row.pdtQty,
      dateDely: yyyymmddInput(row.dateDely),
      timeSlot: row.timeSlot,
      orderStatus: row.orderStatus,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const onChangeEdit = (field, value) => setEditForm((f) => ({ ...f, [field]: value }));

  const remapOrderToRow = (updated) => {
    const itemsArr = Array.isArray(updated.items) ? updated.items : [];
    const first = itemsArr[0] || {};
    const meta = deriveProductMeta(first.productName);

    const custObj = updated.customer && typeof updated.customer === 'object' ? updated.customer : null;
    const custCd = custObj?.custCd || '';
    const custName = custObj?.custName || '';

    const vId = (typeof updated.vehicle === 'string' ? updated.vehicle : updated.vehicle?._id) || null;
    const vDoc = vId ? vehicleById[String(vId)] : null;
    const vNo = updated.vehicleRegNo || updated.vehicle?.vehicleNo || vDoc?.vehicleNo || '';

    const dObj = updated.driver && typeof updated.driver === 'object' ? updated.driver : null;
    const dId =
      dObj?._id ||
      (typeof updated.driver === 'string' ? updated.driver : null) ||
      (updated.vehicle?.driver && typeof updated.vehicle.driver === 'string' ? updated.vehicle.driver : null) ||
      (vDoc && (typeof vDoc.driver === 'string' ? vDoc.driver : vDoc.driver?._id)) ||
      null;

    const dName =
      dObj?.driverName ||
      updated.vehicle?.driver?.driverName ||
      (dId ? driverNameById[String(dId)] : '') ||
      updated.assignedDriverName ||
      '';

    return {
      _id: updated._id,
      orderNo: updated.orderNo || (updated._id || '').slice(-6),
      custId: custCd,
      custName,
      shipToLoc: updated.shipToAddress || '',
      pdtName: meta.name,
      pdtQty: Number(first.quantity || 0),
      uom: first.uom || meta.defaultUom || 'Ltr',
      dateDely: updated.deliveryDate || null,
      timeSlot: updated.deliveryTimeSlot || '',
      orderStatus: updated.orderStatus || 'PENDING',
      vehicleId: vId,
      vehicleRegNo: vNo,
      driverId: dId,
      driverName: dName,
      remarks: updated.remarks || updated.remark || '',
      createdAt: updated.createdAt || null,
      _customerKey: norm(custCd || custName),
    };
  };

  const saveEdit = async (id) => {
    setError(null);
    try {
      const original = rawById[id];
      if (!original) throw new Error('Order not found');

      const items =
        Array.isArray(original.items) && original.items.length > 0
          ? original.items.map((it, idx) =>
              idx === 0 ? { ...it, quantity: Number(editForm.pdtQty || 0) } : it
            )
          : [{ productName: 'diesel', quantity: Number(editForm.pdtQty || 0) }];

      const payload = {
        shipToAddress: editForm.shipToLoc,
        items,
        deliveryDate: editForm.dateDely || null,
        deliveryTimeSlot: editForm.timeSlot,
        orderStatus: editForm.orderStatus,
      };

      const res = await api.put(`/orders/${id}`, payload);
      const updated = res.data;

      setRawById((prev) => ({ ...prev, [id]: updated }));
      const updatedRow = remapOrderToRow(updated);
      setRows((prev) => sortPendingFirst(prev.map((r) => (r._id === id ? updatedRow : r))));

      setEditingId(null);
      setEditForm({});
    } catch {
      setError('Failed to update order.');
    }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    setError(null);
    try {
      const original = rawById[id];
      if (!original) throw new Error('Order not found');

      const payload = {
        shipToAddress: original.shipToAddress || '',
        items: Array.isArray(original.items) ? original.items : [],
        deliveryDate: original.deliveryDate || null,
        deliveryTimeSlot: original.deliveryTimeSlot || '',
        orderStatus: 'CANCELLED',
      };

      const res = await api.put(`/orders/${id}`, payload);
      const updated = res.data;

      setRawById((prev) => ({ ...prev, [id]: updated }));
      const updatedRow = remapOrderToRow(updated);
      setRows((prev) => sortPendingFirst(prev.map((r) => (r._id === id ? updatedRow : r))));
    } catch {
      setError('Failed to cancel order.');
    }
  };

  const btnOrange = 'px-6 py-1.5 rounded bg-[#b85a1d] text-white font-semibold shadow-sm';
  const btnTeal = 'px-8 py-2 rounded bg-[#0f5f78] text-white font-semibold shadow-sm';
  const panelGreen = 'bg-[#d7f2d6] border border-black/30';
  const panelPurple = 'bg-[#e3a3dc] border border-black/30';
  const headerCell = 'px-3 py-2 text-left text-sm font-bold';
  const cell = 'px-3 py-2 text-sm align-top';

  const SectionHeader = ({ title, searchValue, onSearch }) => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 border-b border-black/20">
      <div className="font-bold text-center md:text-left w-full md:w-auto">{title}</div>
      <div className="flex items-center gap-2">
        <span className="bg-yellow-300 px-2 py-1 text-xs font-bold">Order search</span>
        <div className="flex items-center border border-black/20 bg-white rounded px-2">
          <Search size={16} />
          <input
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            className="px-2 py-1 outline-none w-64 text-sm"
            placeholder="Order / Customer / Vehicle"
          />
        </div>
      </div>
    </div>
  );

  const onCustomerQueryChange = (v) => {
    setCustomerQuery(v);
    const k = norm(v);
    const opt = customerOptions.find((o) => o.key === k);
    setSelectedCustomerKey(opt ? opt.key : '');
  };

  const clearCustomerFilter = () => {
    setCustomerQuery('');
    setSelectedCustomerKey('');
  };

  return (
    <div className="max-w-7xl mx-auto p-3 bg-white space-y-3">
      <div className="relative border border-black/30 bg-white">
        <div className="px-3 py-2 text-sm font-semibold">Welcome. {welcomeName}! Fleet manager</div>

        <div className="text-center py-2">
          <div className="text-3xl font-extrabold uppercase leading-tight">
            ORDER MANAGING AND ASSIGN TO DRIVER
            <br />
            MANAGER
          </div>
          <div className="mt-2 text-xl font-bold uppercase">ORDER LIST</div>
        </div>

        <div className="absolute top-2 right-3 flex gap-2">
          <button type="button" className={btnOrange} onClick={() => window.location.assign('/')}>
            Home
          </button>
          <button type="button" className={btnOrange} onClick={() => window.history.back()}>
            Back
          </button>
          <button type="button" className={btnOrange} onClick={() => window.location.assign('/logout')}>
            Log Out
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-6 py-2">
        <button type="button" className={btnTeal} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Order List &amp; Assigned
        </button>
        <button
          type="button"
          className={btnTeal}
          onClick={() => document.getElementById('order-status')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Open / Closed / Cancel Orders
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Date range:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-black/20 rounded px-2 py-1 text-sm"
            />
            <span className="text-sm">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-black/20 rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Customer:</span>
            <input
              value={customerQuery}
              onChange={(e) => onCustomerQueryChange(e.target.value)}
              list="customer-options"
              className="border border-black/20 rounded px-2 py-1 text-sm w-72 bg-white"
              placeholder="Search customer (code or name)"
            />
            <datalist id="customer-options">
              {customerOptions.map((o) => (
                <option key={o.key} value={o.label} />
              ))}
            </datalist>

            {(customerQuery || selectedCustomerKey) && (
              <button
                type="button"
                className="border border-black/20 rounded px-2 py-1 text-sm bg-white hover:bg-gray-50"
                onClick={clearCustomerFilter}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={fetchAll}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-black/20 px-3 py-2 rounded bg-white hover:bg-gray-50 text-sm"
        >
          <RefreshCcw size={16} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded border border-red-200">{error}</div>}

      <div className={panelGreen}>
        <SectionHeader title="Order List" searchValue={searchTop} onSearch={setSearchTop} />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-black/20">
                <th className={headerCell}>S/n</th>
                <th className={headerCell}>Order No.</th>
                <th className={headerCell}>Custome Code</th>
                <th className={headerCell}>Customer Name</th>
                <th className={headerCell}>Shipping Add</th>
                <th className={headerCell}>Product</th>
                <th className={headerCell}>Qty</th>
                <th className={headerCell}>Delivery Dat</th>
                <th className={headerCell}>Delivery time</th>
                <th className={headerCell}>Status</th>
                <th className={headerCell}>Action</th>
                <th className={headerCell}>Assigned</th>
                <th className={headerCell}>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {orderListRows.map((row, idx) => {
                const isEditing = editingId === row._id;
                const modifyOk = canModifyWithin12Hours(row) && row.orderStatus !== 'CANCELLED';

                return (
                  <tr key={row._id} className="border-t border-black/10">
                    <td className={cell}>{idx + 1}</td>
                    <td className={cell}>{row.orderNo || '—'}</td>
                    <td className={cell}>{row.custId || '—'}</td>
                    <td className={cell}>{row.custName || '—'}</td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          className="border border-black/20 rounded px-2 py-1 w-72 text-sm bg-white"
                          value={editForm.shipToLoc || ''}
                          onChange={(e) => onChangeEdit('shipToLoc', e.target.value)}
                        />
                      ) : (
                        <span className="block max-w-[380px]">{row.shipToLoc || '—'}</span>
                      )}
                    </td>

                    <td className={cell}>{row.pdtName || '—'}</td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          type="number"
                          className="border border-black/20 rounded px-2 py-1 w-24 text-sm bg-white"
                          value={editForm.pdtQty ?? ''}
                          onChange={(e) => onChangeEdit('pdtQty', e.target.value)}
                        />
                      ) : (
                        `${row.pdtQty || 0} ${row.uom || 'Ltr'}`
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          type="date"
                          className="border border-black/20 rounded px-2 py-1 text-sm bg-white"
                          value={editForm.dateDely || ''}
                          onChange={(e) => onChangeEdit('dateDely', e.target.value)}
                        />
                      ) : (
                        ddmmyyyy(row.dateDely) || '—'
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          className="border border-black/20 rounded px-2 py-1 w-32 text-sm bg-white"
                          value={editForm.timeSlot || ''}
                          onChange={(e) => onChangeEdit('timeSlot', e.target.value)}
                        />
                      ) : (
                        row.timeSlot || '—'
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <select
                          className="border border-black/20 rounded px-2 py-1 text-sm bg-white"
                          value={editForm.orderStatus || 'PENDING'}
                          onChange={(e) => onChangeEdit('orderStatus', e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {prettyStatus(s)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        prettyStatus(row.orderStatus)
                      )}
                    </td>

                    <td className={cell}>
                      {!isEditing ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-blue-900 hover:text-blue-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelOrder(row._id)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-rose-900 hover:text-rose-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <XCircle size={16} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => saveEdit(row._id)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 hover:text-emerald-950"
                          >
                            <Save size={16} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:text-gray-950"
                          >
                            <XCircle size={16} />
                            Close
                          </button>
                        </div>
                      )}
                    </td>

                    <td className={cell}>{row.vehicleRegNo || row.driverName ? 'Assigned' : '—'}</td>
                    <td className={cell}>{row.remarks || '—'}</td>
                  </tr>
                );
              })}

              {orderListRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-black/60">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={panelPurple}>
        <SectionHeader title="Order Assigned" searchValue={searchAssigned} onSearch={setSearchAssigned} />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-black/20">
                <th className={headerCell}>S/n</th>
                <th className={headerCell}>Order No.</th>
                <th className={headerCell}>Custome Code</th>
                <th className={headerCell}>Customer Name</th>
                <th className={headerCell}>Shipping Add</th>
                <th className={headerCell}>Product</th>
                <th className={headerCell}>Qty</th>
                <th className={headerCell}>Delivery Dat</th>
                <th className={headerCell}>Delivery time</th>
                <th className={headerCell}>Status</th>
                <th className={headerCell}>Vehicle</th>
                <th className={headerCell}>Driver</th>
                <th className={headerCell}>Action</th>
                <th className={headerCell}>Remark</th>
              </tr>
            </thead>

            <tbody>
              {assignedRows.map((row, idx) => {
                const isEditing = editingId === row._id;
                const modifyOk = canModifyWithin12Hours(row) && row.orderStatus !== 'CANCELLED';

                return (
                  <tr key={row._id} className="border-t border-black/10">
                    <td className={cell}>{idx + 1}</td>
                    <td className={cell}>{row.orderNo || '—'}</td>
                    <td className={cell}>{row.custId || '—'}</td>
                    <td className={cell}>{row.custName || '—'}</td>
                    <td className={cell}><span className="block max-w-[380px]">{row.shipToLoc || '—'}</span></td>
                    <td className={cell}>{row.pdtName || '—'}</td>
                    <td className={cell}>{`${row.pdtQty || 0} ${row.uom || 'Ltr'}`}</td>
                    <td className={cell}>{ddmmyyyy(row.dateDely) || '—'}</td>
                    <td className={cell}>{row.timeSlot || '—'}</td>
                    <td className={cell}>{prettyStatus(row.orderStatus)}</td>
                    <td className={cell}>{row.vehicleRegNo || '—'}</td>
                    <td className={cell}>{row.driverName || '—'}</td>

                    <td className={cell}>
                      {!isEditing ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-blue-900 hover:text-blue-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelOrder(row._id)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-rose-900 hover:text-rose-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <XCircle size={16} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => saveEdit(row._id)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 hover:text-emerald-950"
                          >
                            <Save size={16} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:text-gray-950"
                          >
                            <XCircle size={16} />
                            Close
                          </button>
                        </div>
                      )}
                    </td>

                    <td className={cell}>{row.remarks || '—'}</td>
                  </tr>
                );
              })}

              {assignedRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-6 text-center text-black/60">
                    No assigned orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="order-status" className={panelPurple}>
        <SectionHeader title="Order Status" searchValue={searchStatus} onSearch={setSearchStatus} />
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-black/20">
                <th className={headerCell}>S/n</th>
                <th className={headerCell}>Order No.</th>
                <th className={headerCell}>Custome Code</th>
                <th className={headerCell}>Customer Name</th>
                <th className={headerCell}>Shipping Add</th>
                <th className={headerCell}>Product</th>
                <th className={headerCell}>Qty</th>
                <th className={headerCell}>Delivery Dat</th>
                <th className={headerCell}>Delivery time</th>
                <th className={headerCell}>Status</th>
                <th className={headerCell}>Vehicle</th>
                <th className={headerCell}>Driver</th>
                <th className={headerCell}>Action</th>
                <th className={headerCell}>Remark</th>
              </tr>
            </thead>

            <tbody>
              {statusRows.map((row, idx) => {
                const isEditing = editingId === row._id;
                const modifyOk = canModifyWithin12Hours(row) && row.orderStatus !== 'CANCELLED';

                return (
                  <tr key={row._id} className="border-t border-black/10">
                    <td className={cell}>{idx + 1}</td>
                    <td className={cell}>{row.orderNo || '—'}</td>
                    <td className={cell}>{row.custId || '—'}</td>
                    <td className={cell}>{row.custName || '—'}</td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          className="border border-black/20 rounded px-2 py-1 w-72 text-sm bg-white"
                          value={editForm.shipToLoc || ''}
                          onChange={(e) => onChangeEdit('shipToLoc', e.target.value)}
                        />
                      ) : (
                        <span className="block max-w-[380px]">{row.shipToLoc || '—'}</span>
                      )}
                    </td>

                    <td className={cell}>{row.pdtName || '—'}</td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          type="number"
                          className="border border-black/20 rounded px-2 py-1 w-24 text-sm bg-white"
                          value={editForm.pdtQty ?? ''}
                          onChange={(e) => onChangeEdit('pdtQty', e.target.value)}
                        />
                      ) : (
                        `${row.pdtQty || 0} ${row.uom || 'Ltr'}`
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          type="date"
                          className="border border-black/20 rounded px-2 py-1 text-sm bg-white"
                          value={editForm.dateDely || ''}
                          onChange={(e) => onChangeEdit('dateDely', e.target.value)}
                        />
                      ) : (
                        ddmmyyyy(row.dateDely) || '—'
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <input
                          className="border border-black/20 rounded px-2 py-1 w-32 text-sm bg-white"
                          value={editForm.timeSlot || ''}
                          onChange={(e) => onChangeEdit('timeSlot', e.target.value)}
                        />
                      ) : (
                        row.timeSlot || '—'
                      )}
                    </td>

                    <td className={cell}>
                      {isEditing ? (
                        <select
                          className="border border-black/20 rounded px-2 py-1 text-sm bg-white"
                          value={editForm.orderStatus || 'PENDING'}
                          onChange={(e) => onChangeEdit('orderStatus', e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {prettyStatus(s)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        prettyStatus(row.orderStatus)
                      )}
                    </td>

                    <td className={cell}>{row.vehicleRegNo || '—'}</td>
                    <td className={cell}>{row.driverName || '—'}</td>

                    <td className={cell}>
                      {!isEditing ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-blue-900 hover:text-blue-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelOrder(row._id)}
                            disabled={!modifyOk}
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              modifyOk ? 'text-rose-900 hover:text-rose-950' : 'text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <XCircle size={16} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => saveEdit(row._id)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 hover:text-emerald-950"
                          >
                            <Save size={16} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:text-gray-950"
                          >
                            <XCircle size={16} />
                            Close
                          </button>
                        </div>
                      )}
                    </td>

                    <td className={cell}>{row.remarks || '—'}</td>
                  </tr>
                );
              })}

              {statusRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-6 text-center text-black/60">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
