// src/components/OrdersList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { Edit3, Save, XCircle, Search, Trash2, RefreshCcw } from 'lucide-react';

const STATUS_OPTIONS = [
  'PENDING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'CANCELLED'
];

// map product display like your sample
const PRODUCT_MAP = [
  { test: /^(diesel|hsd)$/i, code: '101', name: 'HSD', defaultUom: 'L' },
  { test: /^(petrol|ms)$/i, code: '102', name: 'MS',  defaultUom: 'L' }
];

function deriveProductMeta(productName = '') {
  const found = PRODUCT_MAP.find(m => m.test.test(String(productName)));
  if (!found) {
    return { code: '', name: String(productName || '').toUpperCase(), defaultUom: 'L' };
  }
  return found;
}
function ddmmyyyy(date) {
  if (!date) return '';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function yyyymmddInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

export default function OrdersList() {
  const [rows, setRows]                 = useState([]);
  const [rawById, setRawById]           = useState({});
  const [search, setSearch]             = useState('');
  const [from, setFrom]                 = useState('');
  const [to, setTo]                     = useState('');
  const [error, setError]               = useState(null);
  const [editingId, setEditingId]       = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [lastUpdatedOrder, setLastUpdatedOrder] = useState(null);

  // Reference data (still fetched; we just hide Driver in the table)
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const vehicleById   = useMemo(() => {
    const m = {};
    for (const v of vehicles || []) m[String(v._id)] = v;
    return m;
  }, [vehicles]);
  const vehicleByRegNo = useMemo(() => {
    const m = {};
    for (const v of vehicles || []) m[norm(v.vehicleNo)] = v;
    return m;
  }, [vehicles]);
  const driverNameById = useMemo(() => {
    const m = {};
    for (const d of drivers || []) m[String(d._id)] = d.driverName || d.profile?.empName || '';
    return m;
  }, [drivers]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      setError(null);
      const [ordersRes, vehiclesRes, driversRes] = await Promise.all([
        api.get('/orders'),
        api.get('/vehicles'),
        api.get('/drivers')
      ]);

      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
      setDrivers(Array.isArray(driversRes.data) ? driversRes.data : []);

      const byId = {};
      (ordersRes.data || []).forEach(o => { byId[o._id] = o; });
      setRawById(byId);

      const flattened = (ordersRes.data || []).map(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        const first = items[0] || {};
        const meta = deriveProductMeta(first.productName);
        const orderNo = (typeof o.orderNo === 'string' && o.orderNo) ? o.orderNo : (o._id || '').slice(-6);

        // VEHICLE resolution
        const vehicleIdFromOrder =
          (typeof o.vehicle === 'string' && o.vehicle) ? o.vehicle :
          (o.vehicle?._id || null);
        const vehicleNoFromOrder = o.vehicleRegNo || o.vehicle?.vehicleNo || '';

        let vDoc =
          (vehicleIdFromOrder && vehicleById[vehicleIdFromOrder]) ||
          (vehicleNoFromOrder && vehicleByRegNo[norm(vehicleNoFromOrder)]) ||
          null;

        const vehicleRegNo = vehicleNoFromOrder || vDoc?.vehicleNo || '';
        const vehicleId    = vehicleIdFromOrder || vDoc?._id || null;

        // DRIVER resolution (kept for internal logic; not shown in table)
        const driverObjFromOrder =
          (o.driver && typeof o.driver === 'object' ? o.driver : null) ||
          (o.vehicle?.driver && typeof o.vehicle.driver === 'object' ? o.vehicle.driver : null);

        const driverIdFromOrder =
          (driverObjFromOrder?._id) ||
          (o.driver && typeof o.driver === 'string' ? o.driver : null) ||
          (o.vehicle?.driver && typeof o.vehicle.driver === 'string' ? o.vehicle.driver : null);

        const driverId = driverIdFromOrder || (vDoc?.driver?._id || (typeof vDoc?.driver === 'string' ? vDoc.driver : null)) || null;

        const driverName =
          driverObjFromOrder?.driverName ||
          vDoc?.driver?.driverName ||
          (driverId ? driverNameById[driverId] : '') ||
          o.assignedDriverName || '';

        return {
          _id: o._id,
          orderNo,
          userName: o.empCd || '',
          userType: o.userType || '',
          custId:   o.customer?.custCd || '',
          custName: o.customer?.custName || '',
          shipToLoc: o.shipToAddress || '',
          pdtCode:  meta.code,
          pdtName:  meta.name,
          pdtQty:   Number(first.quantity || 0),
          uom:      first.uom || meta.defaultUom || 'L',
          pdtRate:  Number(first.rate || 0),
          dateDely: o.deliveryDate || null,
          timeSlot: o.deliveryTimeSlot || '',
          orderStatus: o.orderStatus || 'PENDING',

          vehicleId,
          vehicleRegNo,
          driverId,
          driverName,

          _items: items
        };
      });

      setRows(sortPendingFirst(flattened));
    } catch (err) {
      if (err.response?.status === 401) setError('Unauthorized. Please log in.');
      else if (err.response?.status === 403) setError('Access denied. You do not have permission to view orders.');
      else setError('Failed to fetch orders / vehicles / drivers.');
      setRows([]);
      setVehicles([]);
      setDrivers([]);
    }
  }

  const sortPendingFirst = (list) =>
    [...list].sort((a, b) =>
      a.orderStatus === 'PENDING' && b.orderStatus !== 'PENDING' ? -1 : 1
    );

  const filtered = useMemo(() => {
    let temp = [...rows];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      temp = temp.filter(o =>
        (o.orderNo && String(o.orderNo).toLowerCase().includes(s)) ||
        (o.custName && o.custName.toLowerCase().includes(s)) ||
        (o.custId && String(o.custId).toLowerCase().includes(s)) ||
        (o.vehicleRegNo && o.vehicleRegNo.toLowerCase().includes(s)) ||
        (o.pdtName && o.pdtName.toLowerCase().includes(s))
      );
    }
    if (from) temp = temp.filter(o => new Date(o.dateDely || o.createdAt) >= new Date(from));
    if (to) {
      const end = new Date(to); end.setHours(23, 59, 59, 999);
      temp = temp.filter(o => new Date(o.dateDely || o.createdAt) <= end);
    }
    return sortPendingFirst(temp);
  }, [rows, search, from, to]);

  // --- Edit / Update ---
  const startEdit = (row) => {
    setEditingId(row._id);
    setEditForm({
      shipToLoc: row.shipToLoc,
      pdtQty: row.pdtQty,
      pdtRate: row.pdtRate,
      dateDely: yyyymmddInput(row.dateDely),
      timeSlot: row.timeSlot,
      orderStatus: row.orderStatus
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const onChangeEdit = (field, value) => setEditForm(f => ({ ...f, [field]: value }));

  const saveEdit = async (id) => {
    try {
      const original = rawById[id];
      if (!original) throw new Error('Original order not found in memory');

      const items = Array.isArray(original.items) && original.items.length > 0
        ? original.items.map((it, idx) =>
            idx === 0 ? { ...it, quantity: Number(editForm.pdtQty || 0), rate: Number(editForm.pdtRate || 0) } : it
          )
        : [{ productName: 'diesel', quantity: Number(editForm.pdtQty || 0), rate: Number(editForm.pdtRate || 0) }];

      const payload = {
        shipToAddress: editForm.shipToLoc,
        items,
        deliveryDate: editForm.dateDely || null,
        deliveryTimeSlot: editForm.timeSlot,
        orderStatus: editForm.orderStatus
      };

      const res = await api.put(`/orders/${id}`, payload);
      const updated = res.data;

      // remap row
      const itemsArr = Array.isArray(updated.items) ? updated.items : [];
      const first = itemsArr[0] || {};
      const meta = deriveProductMeta(first.productName);

      const vId  = (typeof updated.vehicle === 'string' ? updated.vehicle : updated.vehicle?._id) || null;
      const vDoc = (vId && vehicleById[vId]) || null;
      const vNo  = updated.vehicleRegNo || updated.vehicle?.vehicleNo || vDoc?.vehicleNo || '';

      const dObj = updated.driver && typeof updated.driver === 'object' ? updated.driver : null;
      const dId  =
        (dObj?._id) ||
        (typeof updated.driver === 'string' ? updated.driver : null) ||
        (updated.vehicle?.driver && typeof updated.vehicle.driver === 'string' ? updated.vehicle.driver : null) ||
        (vDoc && (typeof vDoc.driver === 'string' ? vDoc.driver : vDoc.driver?._id)) || null;
      const dName = dObj?.driverName ||
        updated.vehicle?.driver?.driverName ||
        (dId ? driverNameById[dId] : '') ||
        updated.assignedDriverName || '';

      const updatedRow = {
        _id: updated._id,
        orderNo: updated.orderNo || (updated._id || '').slice(-6),
        userName: updated.empCd || '',
        userType: updated.userType || '',
        custId:   updated.customer?.custCd || '',
        custName: updated.customer?.custName || '',
        shipToLoc: updated.shipToAddress || '',
        pdtCode:  meta.code,
        pdtName:  meta.name,
        pdtQty:   Number(first.quantity || 0),
        uom:      first.uom || meta.defaultUom || 'L',
        pdtRate:  Number(first.rate || 0),
        dateDely: updated.deliveryDate || null,
        timeSlot: updated.deliveryTimeSlot || '',
        orderStatus: updated.orderStatus || 'PENDING',
        vehicleId:  vId,
        vehicleRegNo: vNo,
        driverId: dId,
        driverName: dName
      };

      setRows(prev => sortPendingFirst(prev.map(r => (r._id === id ? updatedRow : r))));
      setLastUpdatedOrder(updated);
      setEditingId(null); setEditForm({});
    } catch (err) {
      console.error(err);
      alert('Failed to update order');
    }
  };

  // --- Delete ---
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await api.delete(`/orders/${id}`);
      setRows(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete order');
    }
  };

  // pretty status chip (keeps your palette)
  const statusChipClass = (s) => {
    switch (s) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PARTIALLY_COMPLETED': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-orange-100 text-orange-800 border-orange-200'; // PENDING
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Orders Dashboard</h2>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex items-center border rounded px-2 bg-white shadow-sm">
          <Search size={16} />
          <input
            placeholder="Search Order / Cust / Vehicle / Product"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 py-1 bg-white shadow-sm" />
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="border rounded px-2 py-1 bg-white shadow-sm" />
        </div>
      </div>

      {error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl shadow ring-1 ring-black/5 bg-white">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f3c7a2] text-slate-900/90">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">OrderNo / Status</th>
                  {/* REMOVED UserName */}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Cust Id</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">CustName</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">ShipToLoc</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Pdt_Code</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Pdt_Name</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">PdtQty</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">UoM</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">PdtRate</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Date_Dely</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Time Slot</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Vehicle Allotted</th>
                  {/* REMOVED Driver Allotted */}
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">Modify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {filtered.map(row => {
                  const isEditing = editingId === row._id;
                  const vehicleLast4 = row.vehicleRegNo ? row.vehicleRegNo.slice(-4) : '';

                  return (
                    <tr key={row._id} className="odd:bg-white even:bg-orange-50/40 hover:bg-orange-100/40 transition-colors">
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono text-[13px]">{row.orderNo || '—'}</div>
                        <div className={`inline-flex mt-1 px-2 py-0.5 text-[11px] border rounded-full ${statusChipClass(row.orderStatus)}`}>
                          {row.orderStatus?.replace(/_/g,' ') || 'PENDING'}
                        </div>
                      </td>

                      {/* UserName column removed */}

                      <td className="px-3 py-3 align-top">{row.custId || '—'}</td>
                      <td className="px-3 py-3 align-top">{row.custName || '—'}</td>
                      <td className="px-3 py-3 align-top">
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 w-56"
                            value={editForm.shipToLoc}
                            onChange={e => onChangeEdit('shipToLoc', e.target.value)}
                          />
                        ) : (
                          <span className="line-clamp-3">{row.shipToLoc || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">{row.pdtCode || '—'}</td>
                      <td className="px-3 py-3 align-top">{row.pdtName || '—'}</td>
                      <td className="px-3 py-3 text-right align-top">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtQty}
                            onChange={e => onChangeEdit('pdtQty', e.target.value)}
                          />
                        ) : row.pdtQty}
                      </td>
                      <td className="px-3 py-3 align-top">{row.uom || 'L'}</td>
                      <td className="px-3 py-3 text-right align-top">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtRate}
                            onChange={e => onChangeEdit('pdtRate', e.target.value)}
                          />
                        ) : row.pdtRate}
                      </td>
                      <td className="px-3 py-3 align-top">{ddmmyyyy(row.dateDely)}</td>
                      <td className="px-3 py-3 align-top">{row.timeSlot || '—'}</td>

                      {/* Vehicle Allotted */}
                      <td className="px-3 py-3 align-top">
                        {row.vehicleRegNo ? (
                          <span className="px-2 py-1 rounded bg-green-200/80 text-green-900 font-mono text-xs border border-green-300">
                            {vehicleLast4}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Driver column removed */}

                      <td className="px-3 py-3 align-top text-center">
                        {!isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEdit(row)}
                              className="text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                              title="Update"
                            >
                              <Edit3 size={16} /> Update
                            </button>
                            <button
                              onClick={() => handleDelete(row._id)}
                              className="text-rose-700 hover:text-rose-900 inline-flex items-center gap-1"
                              title="Delete Order"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => saveEdit(row._id)}
                              className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                              title="Save"
                            >
                              <Save size={16} /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
                              title="Cancel"
                            >
                              <XCircle size={16} /> Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    {/* 13 visible columns now */}
                    <td colSpan={13} className="px-4 py-6 text-center text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Optional: last updated order debug panel */}
          {lastUpdatedOrder && (
            <div className="mt-6 bg-[#ffecb3] border border-yellow-200 shadow rounded p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {lastUpdatedOrder.vehicleRegNo || lastUpdatedOrder.vehicle?.vehicleNo || '—'} - Order Summary
                </h3>
                <button
                  onClick={() => setLastUpdatedOrder(null)}
                  className="text-sm text-blue-700 hover:text-blue-900"
                >
                  Hide
                </button>
              </div>
              <pre className="mt-3 text-sm overflow-auto bg-white p-3 rounded">
                {JSON.stringify(lastUpdatedOrder, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
