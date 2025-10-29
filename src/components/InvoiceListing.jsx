import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  Search,
  RefreshCcw,
  FileText
} from 'lucide-react';

/**
 * IDENTICAL TABLE COLUMNS AS YOUR SAMPLE:
 * Cust Id | CustName | ShipToLoc | Pdt_Code | Pdt_Name | PdtQty | UoM | Date_Dely | Time Slot | Order Status | Vehicle Allotted | Actions
 *
 * This component:
 *  - Fetches /trips, /orders, /customers, /routes
 *  - Shows ONLY COMPLETED trips (because those have invoices)
 *  - Builds rows using the same logic/fields you used
 *  - Actions: only "Download Invoice" (no start/close/delete since these are invoices)
 *  - PDF download uses existing GET /trips/:id/invoice
 */

const STATUS = ['ASSIGNED', 'ACTIVE', 'COMPLETED'];

export default function InvoiceListings() {
  const [trips, setTrips] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [routesMap, setRoutesMap] = useState({});

  const [filtered, setFiltered] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('COMPLETED'); // lock to COMPLETED by default
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    setErr(null);
    try {
      const [tripsRes, ordersRes, customersRes, routesRes] = await Promise.all([
        api.get('/trips'),
        api.get('/orders').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/routes').catch(() => ({ data: [] }))
      ]);

      // Keep only COMPLETED trips (i.e., invoiced)
      const list = (tripsRes.data || [])
        .filter(t => t.status === 'COMPLETED')
        .map(t => ({
          ...t,
          createdAt: t.createdAt || new Date(parseInt(String(t._id).substring(0, 8), 16) * 1000).toISOString()
        }));

      setTrips(list);
      setOrders(ordersRes.data || []);
      setCustomers(customersRes.data || []);

      const rmap = {};
      (routesRes.data || []).forEach(r => { rmap[String(r._id)] = r.name || r.routeName || '—'; });
      setRoutesMap(rmap);
    } catch (e) {
      console.error(e);
      setErr('Failed to load invoices listing. Please try again.');
      setTrips([]);
      setOrders([]);
      setCustomers([]);
      setRoutesMap({});
    } finally {
      setLoading(false);
    }
  }

  // Helper maps
  const ordersById = useMemo(() => {
    const m = new Map();
    (orders || []).forEach(o => m.set(String(o._id), o));
    return m;
  }, [orders]);

  const customersById = useMemo(() => {
    const m = new Map();
    (customers || []).forEach(c => m.set(String(c._id), c));
    return m;
  }, [customers]);

  // Build display rows (IDENTICAL FIELD SHAPES)
  const rows = useMemo(() => {
    return (trips || []).map(t => {
      const order = ordersById.get(String(t.orderId)) || {};
      const custId =
        typeof order.customer === 'object'
          ? order.customer?._id
          : order.customer;
      const cust = customersById.get(String(custId)) || {};

      const firstItem = Array.isArray(order.items) ? (order.items[0] || {}) : {};
      const totalQty = Array.isArray(order.items)
        ? order.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
        : null;

      const dateDely = order.deliveryDate || order.expectedDate || t.logoutTime || t.createdAt || null;
      const timeSlot = order.timeSlot || order.deliverySlot || order.slot || '';

      return {
        _id: t._id,
        tripNo: t.tripNo,
        createdAt: t.createdAt,
        status: t.status, // always COMPLETED in this screen

        custId: cust.custCd || cust.customerCode || '—',
        custName: cust.custName || cust.name || '—',
        shipToLoc: order.shipToAddress || order.shipTo || '—',

        pdtCode: firstItem.productCode || firstItem.productId || '—',
        pdtName: firstItem.productName || '—',
        pdtQty: totalQty ?? firstItem.quantity ?? '—',
        uom: firstItem.uom || 'Liter',

        dateDely,
        timeSlot,
        orderStatus: order.orderStatus || '—',

        vehicleAllotted: t?.snapshot?.vehicleNo || (t.vehicle?.vehicleNo) || '—',
        routeId: t.routeId
      };
    });
  }, [trips, ordersById, customersById]);

  // Filtering + sort (keep identical behavior)
  useEffect(() => {
    let tmp = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      tmp = tmp.filter(r =>
        [
          r.tripNo,
          r.custId,
          r.custName,
          r.shipToLoc,
          r.pdtCode,
          r.pdtName,
          r.vehicleAllotted,
          r.orderStatus
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'ALL') {
      tmp = tmp.filter(r => r.status === statusFilter);
    }

    if (from) {
      const f = new Date(from);
      tmp = tmp.filter(r => new Date(r.createdAt) >= f);
    }
    if (to) {
      const tt = new Date(to);
      tt.setHours(23, 59, 59, 999);
      tmp = tmp.filter(r => new Date(r.createdAt) <= tt);
    }

    // Sort identical: ACTIVE first, then ASSIGNED, then COMPLETED, newest first
    const rank = { ACTIVE: 0, ASSIGNED: 1, COMPLETED: 2 };
    tmp.sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    setFiltered(tmp);
  }, [rows, search, statusFilter, from, to]);

  const routeName  = (id) => routesMap[String(id)] || '—';

  // Download invoice (PDF from your existing trip endpoint)
  const downloadInvoice = async (id, tripNo) => {
    try {
      const res = await api.get(`/trips/${id}/invoice`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const invNo = computeInvoiceNoFromTrip(tripNo);
      a.download = `${invNo || `invoice_${id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to download invoice.');
    }
  };

  const chip = (status) => {
    const base = 'inline-block text-xs px-2 py-1 rounded border';
    if (status === 'ACTIVE') return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>ACTIVE</span>;
    if (status === 'ASSIGNED') return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>ASSIGNED</span>;
    return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>COMPLETED</span>;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Voucher Listings</h2>
        <button
          onClick={fetchAll}
          className="ml-auto inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {err && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{err}</div>}

      {/* Filters (kept identical, defaulting to COMPLETED) */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center border bg-white rounded px-2">
          <Search size={16} />
          <input
            placeholder="Search cust, product, vehicle, trip no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1 outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="Trip Status"
        >
          {/* you can allow switching, but this screen is meant for COMPLETED */}
          <option value="ALL">All Trip Status</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
          title="To date"
        />
      </div>

      {/* Table (IDENTICAL HEADERS) */}
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-[1200px] w-full">
          <thead>
            <tr className="bg-yellow-300">
              <Th>Cust Id</Th>
              <Th>CustName</Th>
              <Th>ShipToLoc</Th>
              <Th>Pdt_Code</Th>
              <Th>Pdt_Name</Th>
              <Th>PdtQty</Th>
              <Th>UoM</Th>
              <Th>Date_Dely</Th>
              <Th>Time Slot</Th>
              <Th>Order Status</Th>
              <Th>Vehicle Allotted</Th>
              <Th className="text-center">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center" colSpan={12}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={12}>No invoices found.</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <Td>{r.custId}</Td>
                  <Td>{r.custName}</Td>
                  <Td className="max-w-[280px] truncate" title={r.shipToLoc}>{r.shipToLoc}</Td>
                  <Td>{r.pdtCode}</Td>
                  <Td>{r.pdtName}</Td>
                  <Td>{r.pdtQty ?? '—'}</Td>
                  <Td>{r.uom}</Td>
                  <Td>{r.dateDely ? new Date(r.dateDely).toLocaleDateString() : '—'}</Td>
                  <Td>{r.timeSlot || '—'}</Td>
                  <Td>{r.orderStatus}</Td>
                  <Td>{r.vehicleAllotted}</Td>
                  <Td>
                    <div className="inline-flex items-center gap-2 justify-center">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        title="Download Invoice"
                        onClick={() => downloadInvoice(r._id, r.tripNo)}
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                    <div className="mt-1">{chip(r.status)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Trip: {r.tripNo}</div>
                    <div className="text-xs text-gray-500">Route: {routeName(r.routeId)}</div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- tiny building blocks ---------- */
function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold border border-black ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 border-t align-top ${className}`}>
      {children}
    </td>
  );
}

/* ---------- helpers ---------- */
function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
function computeInvoiceNoFromTrip(tripNo) {
  const d = digitsOnly(tripNo);
  return `INV${(d || '').padStart(6, '0')}`;
}
