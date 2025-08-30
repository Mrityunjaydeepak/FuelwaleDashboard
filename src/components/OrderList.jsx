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

  // NEW: reference data for vehicles & drivers so we can show the driver tied to a vehicle
  const [vehicles, setVehicles] = useState([]);                 // raw list from /vehicles
  const [drivers, setDrivers]   = useState([]);                 // raw list from /drivers
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

        // --- VEHICLE LOOKUP ---
        // from order first; if missing, try to resolve vehicle by number from the vehicles list
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

        // --- DRIVER LOOKUP ---
        // priority: order.driver (object) → vehicle.driver (object or id) → map id to name via /drivers
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
        (o.orderNo && String(o.orderNo).includes(search)) ||
        (o.custName && o.custName.toLowerCase().includes(s)) ||
        (o.custId && String(o.custId).toLowerCase().includes(s)) ||
        (o.userName && String(o.userName).toLowerCase().includes(s)) ||
        (o.driverName && o.driverName.toLowerCase().includes(s)) ||
        (o.vehicleRegNo && o.vehicleRegNo.toLowerCase().includes(s))
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

      // re-map just this row
      const itemsArr = Array.isArray(updated.items) ? updated.items : [];
      const first = itemsArr[0] || {};
      const meta = deriveProductMeta(first.productName);

      // resolve vehicle + driver again after update
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Orders Dashboard</h2>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex items-center border rounded px-2 bg-white">
          <Search size={16} />
          <input
            placeholder="Search Order / User / Cust / Vehicle / Driver"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 py-1 bg-white" />
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="border rounded px-2 py-1 bg-white" />
        </div>
      </div>

      {error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow rounded">
              <thead>
                <tr className="bg-[#f3c7a2]">
                  <th className="px-3 py-2 text-left">OrderNo</th>
                  <th className="px-3 py-2 text-left">UserName</th>
                  <th className="px-3 py-2 text-left">Cust Id</th>
                  <th className="px-3 py-2 text-left">CustName</th>
                  <th className="px-3 py-2 text-left">ShipToLoc</th>
                  <th className="px-3 py-2 text-left">Pdt_Code</th>
                  <th className="px-3 py-2 text-left">Pdt_Name</th>
                  <th className="px-3 py-2 text-right">PdtQty</th>
                  <th className="px-3 py-2 text-left">UoM</th>
                  <th className="px-3 py-2 text-right">PdtRate</th>
                  <th className="px-3 py-2 text-left">Date_Dely</th>
                  <th className="px-3 py-2 text-left">Time Slot</th>
                  <th className="px-3 py-2 text-left">Vehicle Allotted</th>
                  <th className="px-3 py-2 text-left">Driver Allotted</th>
                  <th className="px-3 py-2 text-center">Modify</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const isEditing = editingId === row._id;
                  const vehicleLast4 = row.vehicleRegNo ? row.vehicleRegNo.slice(-4) : '';

                  return (
                    <tr key={row._id} className="hover:bg-gray-50 align-top">
                      <td className="border px-3 py-2 font-mono">{row.orderNo || '—'}</td>
                      <td className="border px-3 py-2">{row.userName || '—'}</td>
                      <td className="border px-3 py-2">{row.custId || '—'}</td>
                      <td className="border px-3 py-2">{row.custName || '—'}</td>
                      <td className="border px-3 py-2">
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 w-56"
                            value={editForm.shipToLoc}
                            onChange={e => onChangeEdit('shipToLoc', e.target.value)}
                          />
                        ) : (row.shipToLoc || '—')}
                      </td>
                      <td className="border px-3 py-2">{row.pdtCode || '—'}</td>
                      <td className="border px-3 py-2">{row.pdtName || '—'}</td>
                      <td className="border px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtQty}
                            onChange={e => onChangeEdit('pdtQty', e.target.value)}
                          />
                        ) : row.pdtQty}
                      </td>
                      <td className="border px-3 py-2">{row.uom || 'L'}</td>
                      <td className="border px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtRate}
                            onChange={e => onChangeEdit('pdtRate', e.target.value)}
                          />
                        ) : row.pdtRate}
                      </td>
                      <td className="border px-3 py-2">{ddmmyyyy(row.dateDely)}</td>
                      <td className="border px-3 py-2">{row.timeSlot || '—'}</td>

                      {/* Vehicle Allotted (green last4 style) */}
                      <td className="border px-3 py-2">
                        {row.vehicleRegNo ? (
                          <span className="px-2 py-1 rounded bg-green-200 font-mono">{vehicleLast4}</span>
                        ) : '—'}
                      </td>

                      {/* Driver Allotted (read-only from resolved vehicle/order) */}
                      <td className="border px-3 py-2">
                        {row.driverName || '—'}
                      </td>

                      {/* Modify (Update / Delete) */}
                      <td className="border px-3 py-2 text-center">
                        {!isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEdit(row)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              title="Update"
                            >
                              <Edit3 size={16} /> Update
                            </button>
                            <button
                              onClick={() => handleDelete(row._id)}
                              className="text-red-600 hover:text-red-800 flex items-center gap-1"
                              title="Delete Order"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => saveEdit(row._id)}
                              className="text-green-600 hover:text-green-800 flex items-center gap-1"
                              title="Save"
                            >
                              <Save size={16} /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
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
                    <td colSpan={16} className="px-4 py-6 text-center text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Optional: show the last updated order payload for debugging */}
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
