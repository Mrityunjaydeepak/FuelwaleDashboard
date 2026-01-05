// src/components/ManageOrders.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PlusIcon, Trash2, X, CheckCircle2 } from 'lucide-react';

export default function ManageOrders() {
  const navigate = useNavigate();

  const initialForm = {
    customerId: '',
    shipToAddress: '',
    items: [{ productName: 'diesel', quantity: '' }],
    deliveryDate: '',
    deliveryTimeStart: '',
    deliveryTimeEnd: '',
    orderType: 'Regular',
    remarks: '',
  };

  const [form, setForm] = useState(initialForm);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);

  const [shipToChoice, setShipToChoice] = useState('shipTo1');

  const [currentUserMongoId, setCurrentUserMongoId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('');

  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const isMongoObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(String(v || '').trim());

  const formatYMDLocal = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const today = formatYMDLocal(new Date());
    setDateFrom(today);
    setDateTo(today);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
      const u = JSON.parse(raw);
      const mongoId = u?.id;
      const userId = u?.userId || '';
      const userType = u?.userType || '';
      setCurrentUserMongoId(isMongoObjectId(mongoId) ? String(mongoId) : null);
      setCurrentUserId(userId);
      setCurrentUserType(userType);
    } catch {
      // ignore
    }
  }, []);

  const roleLabelMap = {
    A: 'Admin',
    E: 'Sales Employee',
    D: 'Driver',
    C: 'Customer',
    VA: 'Vehicle Allocation',
    TR: 'Trips',
    AC: 'Accounts',
  };

  const roleLabel = roleLabelMap[currentUserType] || '';
  const displayName = currentUserId || 'User';
  const isAdmin = currentUserType === 'A';

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c._id) === String(form.customerId)) || null,
    [customers, form.customerId]
  );

  const customerById = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      map[String(c._id)] = c;
    });
    return map;
  }, [customers]);

  const buildShipToValueFromFields = (c, idx) => {
    const a1 = c?.[`shipTo${idx}Add1`] || '';
    const a2 = c?.[`shipTo${idx}Add2`] || '';
    const a3 = c?.[`shipTo${idx}Add3`] || '';
    const area = c?.[`shipTo${idx}Area`] || '';
    const city = c?.[`shipTo${idx}City`] || '';
    const pin =
      c?.[`shipTo${idx}Pin`] != null && c[`shipTo${idx}Pin`] !== ''
        ? String(c[`shipTo${idx}Pin`])
        : '';
    const st = c?.[`shipTo${idx}StateCd`] || '';
    const lines = [a1, a2, a3].filter(Boolean).join('\n');
    const areaCity = [area, city].filter(Boolean).join(', ');
    const tail = [pin, st].filter(Boolean).join(', ');
    return [lines, areaCity, tail].filter(Boolean).join('\n').trim();
  };

  const buildShipToValueFromArray = (c, idx) => {
    const arr = Array.isArray(c?.shipTo) ? c.shipTo : [];
    const raw = arr[idx - 1];
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();
    if (raw && typeof raw === 'object') {
      const { add1, add2, add3, area, city, pin, stateCd } = raw;
      const lines = [add1, add2, add3].filter(Boolean).join('\n');
      const areaCity = [area, city].filter(Boolean).join(', ');
      const tail = [pin, stateCd].filter(Boolean).join(', ');
      return [lines, areaCity, tail].filter(Boolean).join('\n').trim();
    }
    return '';
  };

  const shipToOptions = useMemo(() => {
    if (!selectedCustomer) return [];
    const opts = [];
    for (let i = 1; i <= 5; i++) {
      let value = buildShipToValueFromFields(selectedCustomer, i);
      if (!value) value = buildShipToValueFromArray(selectedCustomer, i);
      const firstLine =
        selectedCustomer[`shipTo${i}Add1`] ||
        (typeof selectedCustomer.shipTo?.[i - 1] === 'string'
          ? selectedCustomer.shipTo[i - 1].split('\n')[0]
          : selectedCustomer.shipTo?.[i - 1]?.add1) ||
        value.split('\n')[0] ||
        '';
      opts.push({
        key: `shipTo${i}`,
        label: firstLine || '(empty)',
        value,
        empty: value.length === 0,
      });
    }
    return opts;
  }, [selectedCustomer]);

  useEffect(() => {
    let alive = true;
    api
      .get('/customers')
      .then((res) => {
        if (!alive) return;
        setCustomers(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) =>
        setError(err.response?.data?.error || 'Failed to load customers.')
      );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setOrdersLoading(true);
    api
      .get('/orders')
      .then((res) => {
        if (!alive) return;
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setOrdersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (editingOrderId) return;
    if (!selectedCustomer) {
      setShipToChoice('shipTo1');
      setForm((f) => ({ ...f, shipToAddress: '' }));
      return;
    }
    if (shipToOptions.length) {
      const firstNonEmpty = shipToOptions.find((o) => !o.empty) || shipToOptions[0];
      setShipToChoice(firstNonEmpty.key);
      setForm((f) => ({ ...f, shipToAddress: firstNonEmpty.value }));
    }
  }, [selectedCustomer, shipToOptions, editingOrderId]);

  const handleHome = () => navigate('/');
  const handleBack = () => navigate(-1);

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  };

  const handleItemChange = (idx, e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [name]: value };
      return { ...f, items };
    });
    setError('');
  };

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { productName: 'diesel', quantity: '' }],
    }));
  };

  const removeItem = (idx) => {
    setForm((f) => {
      if (f.items.length === 1) return f;
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items };
    });
  };

  const handleShipToChoiceChange = (key) => {
    setShipToChoice(key);
    const opt = shipToOptions.find((o) => o.key === key);
    setForm((f) => ({ ...f, shipToAddress: opt ? opt.value : '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.customerId) return setError('Please select a customer.');
    if (!form.deliveryDate) return setError('Please select a delivery date.');
    if (!form.deliveryTimeStart || !form.deliveryTimeEnd)
      return setError('Please select a delivery time range.');
    if (form.deliveryTimeEnd <= form.deliveryTimeStart)
      return setError('Time To must be later than Time From.');
    const cleanedItems = form.items
      .map((i) => ({
        productName: (i.productName || '').trim() || 'diesel',
        quantity: Number(i.quantity),
      }))
      .filter((i) => i.quantity > 0);
    if (cleanedItems.length === 0)
      return setError('Please add at least one item with a quantity greater than 0.');
    const deliveryTimeSlot = `${form.deliveryTimeStart} - ${form.deliveryTimeEnd}`;
    const payload = {
      customerId: form.customerId,
      shipToAddress: form.shipToAddress,
      orderType: form.orderType,
      items: cleanedItems,
      deliveryDate: form.deliveryDate,
      deliveryTimeSlot,
      empCd: currentUserId || '',
      remarks: (form.remarks || '').trim(),
    };
    setPendingPayload(payload);
    setShowConfirm(true);
  };

  const confirmAndPost = async () => {
    if (!pendingPayload) return;
    setLoading(true);
    try {
      let res;
      if (editingOrderId) {
        const { createdBy, ...updatePayload } = pendingPayload || {};
        res = await api.put(`/orders/${editingOrderId}`, updatePayload);
        if (res?.data) {
          setOrders((prev) =>
            prev.map((o) => (o._id === editingOrderId ? { ...o, ...res.data } : o))
          );
        } else {
          setOrders((prev) =>
            prev.map((o) => (o._id === editingOrderId ? { ...o, ...updatePayload } : o))
          );
        }
      } else {
        res = await api.post('/orders', pendingPayload);
        if (res?.data) {
          setOrders((prev) => [res.data, ...prev]);
        }
      }
      setForm(initialForm);
      setShipToChoice('shipTo1');
      setPendingPayload(null);
      setShowConfirm(false);
      setEditingOrderId(null);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (editingOrderId ? 'Failed to update order.' : 'Failed to create order.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (order) => {
    setError('');
    setEditingOrderId(order._id || null);
    const deliveryTimeSlot = order.deliveryTimeSlot || '';
    let deliveryTimeStart = '';
    let deliveryTimeEnd = '';
    if (deliveryTimeSlot.includes('-')) {
      const [start, end] = deliveryTimeSlot.split('-');
      deliveryTimeStart = start.trim();
      deliveryTimeEnd = end.trim();
    }
    const customerId =
      order.customerId ||
      (typeof order.customer === 'object' ? order.customer?._id : order.customer) ||
      '';
    const items =
      Array.isArray(order.items) && order.items.length > 0
        ? order.items.map((it) => ({
            productName: (it.productName || '').trim() || 'diesel',
            quantity: it.quantity != null ? String(it.quantity) : '',
          }))
        : [{ productName: 'diesel', quantity: '' }];
    setForm({
      customerId,
      shipToAddress: order.shipToAddress || '',
      items,
      deliveryDate: order.deliveryDate ? String(order.deliveryDate).slice(0, 10) : '',
      deliveryTimeStart,
      deliveryTimeEnd,
      orderType: order.orderType || 'Regular',
      remarks: order.remarks || '',
    });
    setShipToChoice('shipTo1');
  };

  const handleSetOrderStatus = async (order, status) => {
    if (!order?._id) return;
    const label = status === 'COMPLETED' ? 'complete' : 'cancel';
    if (!window.confirm(`Are you sure you want to ${label} this order?`)) return;
    try {
      const res = await api.put(`/orders/${order._id}`, { orderStatus: status });
      const serverOrder = res?.data;
      setOrders((prev) =>
        prev.map((o) => {
          if (o._id !== order._id) return o;
          let merged = serverOrder ? { ...o, ...serverOrder } : { ...o, orderStatus: status };
          if (
            o.customer &&
            typeof o.customer === 'object' &&
            merged.customer &&
            typeof merged.customer !== 'object'
          ) {
            merged.customer = o.customer;
          }
          if (
            o.createdBy &&
            typeof o.createdBy === 'object' &&
            merged.createdBy &&
            typeof merged.createdBy !== 'object'
          ) {
            merged.createdBy = o.createdBy;
          }
          return merged;
        })
      );
    } catch (err) {
      setError(err.response?.data?.error || `Failed to update order status (${status}).`);
    }
  };

  const activeCustomers = customers.filter((c) => c.status === 'Active');
  const inactiveCustomers = customers.filter((c) => c.status !== 'Active');

  const totalQuantity = useMemo(
    () =>
      form.items.reduce((sum, it) => {
        const q = Number(it.quantity || 0);
        return sum + (isFinite(q) ? q : 0);
      }, 0),
    [form.items]
  );

  const getCreatedByKey = (order) => {
    const code = order?.createdByUserId || order?.empCd || '';
    return String(code || '').trim();
  };

  const getCreatedByLabel = (order) => {
    const code = (order?.createdByUserId || order?.empCd || '').toString().trim();
    const name = (order?.createdByName || '').toString().trim();
    if (code || name) return [code, name].filter(Boolean).join(' — ').trim();
    const cb = order?.createdBy;
    if (cb && typeof cb === 'object') {
      const c = cb.empCd || cb.userId || cb.code || '';
      const n = cb.empName || cb.name || cb.fullName || '';
      return [c, n].filter(Boolean).join(' — ').trim() || '—';
    }
    return '—';
  };

  const employeeOptions = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const key = getCreatedByKey(o);
      const label = getCreatedByLabel(o);
      if (key && !map.has(key)) map.set(key, label);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    const from = dateFrom || '';
    const to = dateTo || '';
    const emp = employeeFilter || '';
    const inRange = (ymd) => {
      if (!ymd) return false;
      if (from && ymd < from) return false;
      if (to && ymd > to) return false;
      return true;
    };
    return orders.filter((order) => {
      const customerKey =
        order.customerId ??
        (typeof order.customer === 'object' ? order.customer?._id : order.customer);
      const custFromMap = customerKey ? customerById[String(customerKey)] : null;
      const custObj =
        custFromMap ||
        (typeof order.customer === 'object' ? order.customer : {}) ||
        {};
      const customerCode = (custObj.custCd || order.custCd || '').toString();
      const customerName = (custObj.custName || order.custName || '').toString();
      const orderNo = (order.orderNo || (order._id ? order._id.slice(-6) : '')).toString();
      const deliveryYMD = order.deliveryDate ? String(order.deliveryDate).slice(0, 10) : '';
      if ((from || to) && !inRange(deliveryYMD)) return false;
      if (emp) {
        const key = getCreatedByKey(order);
        if (String(key) !== String(emp)) return false;
      }
      if (q) {
        const hay = [
          orderNo,
          customerCode,
          customerName,
          (order.shipToAddress || '').toString(),
          (getCreatedByLabel(order) || '').toString(),
          (order.remarks || '').toString(),
        ]
          .join(' | ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, customerById, searchText, dateFrom, dateTo, employeeFilter]);

  const escapeHtml = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportToExcelCSV = () => {
    const rows = filteredOrders.map((order, index) => {
      const customerKey =
        order.customerId ??
        (typeof order.customer === 'object' ? order.customer?._id : order.customer);
      const custFromMap = customerKey ? customerById[String(customerKey)] : null;
      const custObj =
        custFromMap ||
        (typeof order.customer === 'object' ? order.customer : {}) ||
        {};
      const customerCode = custObj.custCd || order.custCd || '—';
      const customerName = custObj.custName || order.custName || '—';
      const itemsText = Array.isArray(order.items)
        ? order.items
            .map((it) => `${it.productName || 'item'}(${Number(it.quantity || 0)})`)
            .join(', ')
        : '';
      const totalQty = Array.isArray(order.items)
        ? order.items.reduce((s, it) => s + Number(it.quantity || 0), 0)
        : '';
      return {
        sn: index + 1,
        orderNo: order.orderNo || (order._id ? order._id.slice(-6) : '—'),
        customerCode,
        customerName,
        salesEmployee: getCreatedByLabel(order),
        shipToAddress: order.shipToAddress || '—',
        items: itemsText || '—',
        totalQty: totalQty || '—',
        deliveryDate: order.deliveryDate ? String(order.deliveryDate).slice(0, 10) : '—',
        deliveryTime: order.deliveryTimeSlot || '—',
        status: order.orderStatus || 'PENDING',
        remarks: order.remarks || '—',
      };
    });
    const headers = [
      'S/N',
      'Order No',
      'Customer Code',
      'Customer Name',
      'Sales Employee',
      'Shipping Address',
      'Items',
      'Total Qty',
      'Delivery Date',
      'Delivery Time',
      'Status',
      'Remarks',
    ];
    const csvEscape = (v) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.sn,
          r.orderNo,
          r.customerCode,
          r.customerName,
          r.salesEmployee,
          r.shipToAddress,
          r.items,
          r.totalQty,
          r.deliveryDate,
          r.deliveryTime,
          r.status,
          r.remarks,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ].join('\n');
    const stamp = formatYMDLocal(new Date());
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `orders_${stamp}.csv`);
  };

  const exportToPDF = () => {
    const stamp = formatYMDLocal(new Date());
    const title = `Orders Export (${stamp})`;
    const htmlRows = filteredOrders
      .map((order, index) => {
        const customerKey =
          order.customerId ??
          (typeof order.customer === 'object' ? order.customer?._id : order.customer);
        const custFromMap = customerKey ? customerById[String(customerKey)] : null;
        const custObj =
          custFromMap ||
          (typeof order.customer === 'object' ? order.customer : {}) ||
          {};
        const customerCode = custObj.custCd || order.custCd || '—';
        const customerName = custObj.custName || order.custName || '—';
        const itemsText = Array.isArray(order.items)
          ? order.items
              .map((it) => `${it.productName || 'item'}(${Number(it.quantity || 0)})`)
              .join(', ')
          : '—';
        const totalQty = Array.isArray(order.items)
          ? order.items.reduce((s, it) => s + Number(it.quantity || 0), 0)
          : '—';
        return `
          <tr>
            <td>${escapeHtml(index + 1)}</td>
            <td>${escapeHtml(order.orderNo || (order._id ? order._id.slice(-6) : '—'))}</td>
            <td>${escapeHtml(customerCode)}</td>
            <td>${escapeHtml(customerName)}</td>
            <td>${escapeHtml(getCreatedByLabel(order))}</td>
            <td>${escapeHtml(order.shipToAddress || '—')}</td>
            <td>${escapeHtml(itemsText)}</td>
            <td style="text-align:right">${escapeHtml(totalQty)}</td>
            <td>${escapeHtml(order.deliveryDate ? String(order.deliveryDate).slice(0, 10) : '—')}</td>
            <td>${escapeHtml(order.deliveryTimeSlot || '—')}</td>
            <td>${escapeHtml(order.orderStatus || 'PENDING')}</td>
            <td>${escapeHtml(order.remarks || '—')}</td>
          </tr>
        `;
      })
      .join('');
    const w = window.open('', '_blank');
    if (!w) {
      setError('Popup blocked. Please allow popups to export PDF.');
      return;
    }
    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 12px; }
            h1 { font-size: 14px; margin: 0 0 10px; }
            .meta { margin-bottom: 10px; color: #444; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
            th { background: #f5f5f5; text-align: left; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">
            Filters: Date ${escapeHtml(dateFrom || '—')} to ${escapeHtml(dateTo || '—')},
            Employee ${escapeHtml(
              employeeFilter
                ? (employeeOptions.find(o => o.key === employeeFilter)?.label || employeeFilter)
                : 'All'
            )},
            Search "${escapeHtml(searchText || '')}"
          </div>
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Order No</th>
                <th>Customer Code</th>
                <th>Customer Name</th>
                <th>Sales Employee</th>
                <th>Shipping Address</th>
                <th>Items</th>
                <th>Total Qty</th>
                <th>Delivery Date</th>
                <th>Delivery Time</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${
                htmlRows ||
                `<tr><td colspan="12" style="text-align:center;color:#666;">No orders to export.</td></tr>`
              }
            </tbody>
          </table>
          <script>
            window.onload = function() { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-[#f7f7fb] py-4 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm text-[11px] sm:text-xs rounded-md overflow-hidden">
        {/* top bar only with user + nav */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="text-[10px] sm:text-[11px] text-gray-700">
            Welcome, <span className="font-semibold">{displayName}</span>
            {roleLabel && <> ({roleLabel})</>}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleHome}
              className="px-3 py-1 border border-gray-300 rounded-sm text-[10px] bg-white text-gray-700 hover:bg-gray-100"
            >
              Home
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-3 py-1 border border-gray-300 rounded-sm text-[10px] bg-white text-gray-700 hover:bg-gray-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1 border border-red-300 rounded-sm text-[10px] bg-red-50 text-red-700 hover:bg-red-100"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>
          <section className="bg-white px-4 py-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap gap-2 items-baseline text-gray-700">
                  <span className="font-medium">Mapped Depot Code</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCustomer?.depotCd || '—'}
                  </span>
                  <span className="ml-4 font-medium">Depot Name</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCustomer?.depotName || selectedCustomer?.depotName || '—'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 items-baseline text-gray-700">
                  <span className="font-medium">Selected Customer</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCustomer?.custCd || '—'}
                  </span>
                  <span className="ml-4 font-medium">Customer Name</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCustomer?.custName || '—'}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <div className="inline-block bg-yellow-100 border border-yellow-300 px-3 py-1 text-[11px] font-semibold rounded-sm text-yellow-800">
                  Search Customer
                </div>
                <div className="mt-2">
                  <select
                    name="customerId"
                    value={form.customerId}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                    required
                  >
                    <option value="">Select Customer</option>
                    {activeCustomers.length > 0 && (
                      <optgroup label="Active">
                        {activeCustomers.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.custCd} — {c.custName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {inactiveCustomers.length > 0 && (
                      <optgroup label="Inactive / Suspended">
                        {inactiveCustomers.map((c) => (
                          <option
                            key={c._id}
                            value={c._id}
                            disabled
                            className="text-gray-400"
                          >
                            {c.custCd} — {c.custName} ({c.status})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div className="mt-1 text-[10px] text-gray-500">
                    Search by Name / Customer Code with a date filter for order view.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 space-y-2">
                <div className="font-medium text-gray-800">
                  Order Type <span className="font-normal text-gray-500">(Regular / Express)</span>
                </div>
                <div className="flex gap-3 mt-1 text-gray-700">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      className="h-3 w-3"
                      name="orderType"
                      value="Regular"
                      checked={form.orderType === 'Regular'}
                      onChange={handleFormChange}
                    />
                    <span>Regular</span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      className="h-3 w-3"
                      name="orderType"
                      value="Express"
                      checked={form.orderType === 'Express'}
                      onChange={handleFormChange}
                    />
                    <span>Express</span>
                  </label>
                </div>
              </div>

              {selectedCustomer && (
                <div className="flex-1">
                  <div className="font-medium mb-1 text-gray-800">
                    Select Shipping Address 1 / 2 / 3 / ...
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
                    {shipToOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={opt.empty}
                        onClick={() => handleShipToChoiceChange(opt.key)}
                        className={`text-left border rounded-sm px-2 py-1 h-full transition ${
                          shipToChoice === opt.key
                            ? 'border-blue-500 ring-1 ring-blue-300 bg-blue-50'
                            : 'border-gray-300 bg-gray-50'
                        } ${opt.empty ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-semibold truncate text-gray-800">
                          Area {opt.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  <textarea
                    readOnly
                    value={form.shipToAddress}
                    className="mt-2 w-full border border-gray-300 rounded-sm px-2 py-1 bg-white text-[11px] text-gray-800"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="font-medium mb-1 text-gray-800">Product Details</div>
              <div className="space-y-1">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 sm:col-span-4">
                      <label className="block text-[10px] font-medium text-gray-700">
                        Product Name
                      </label>
                      <input
                        name="productName"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, e)}
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                        placeholder="Diesel"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-4">
                      <label className="block text-[10px] font-medium text-gray-700">
                        Quantity (L)
                      </label>
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, e)}
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-right"
                        required
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-4 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={form.items.length === 1}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-sm text-[11px] shadow-sm"
                >
                  <PlusIcon size={12} /> Add Item
                </button>
                <div className="text-[11px] text-gray-700">
                  <span className="font-semibold">Total Quantity: </span>
                  {totalQuantity} L
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700">
                  Delivery Date
                </label>
                <input
                  type="date"
                  name="deliveryDate"
                  value={form.deliveryDate}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700">
                  Time From
                </label>
                <input
                  type="time"
                  name="deliveryTimeStart"
                  value={form.deliveryTimeStart}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700">
                  Time To
                </label>
                <input
                  type="time"
                  name="deliveryTimeEnd"
                  value={form.deliveryTimeEnd}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleFormChange}
                  rows={2}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white text-[11px] text-gray-800"
                  placeholder="Optional notes about this order…"
                />
              </div>
            </div>

            {error && (
              <div className="mt-2 text-red-600 text-[11px] font-medium">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-700 text-white rounded-sm text-[11px] font-semibold hover:bg-blue-800 disabled:opacity-60 shadow-sm"
              >
                {loading
                  ? editingOrderId
                    ? 'Updating…'
                    : 'Submitting…'
                  : editingOrderId
                  ? 'Update Order'
                  : 'Submit Order'}
              </button>
            </div>
          </section>
        </form>

        {/* SEARCH + FILTERS + EXPORT */}
        <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="font-semibold text-[11px] text-gray-800">
                Search Orders
              </div>
              <div className="text-[10px] text-gray-600">
                Default view shows today’s orders. Use date range / employee / search to filter.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700">
                  Search (Order / Customer / Address / Employee / Remarks)
                </label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                  placeholder="Type to search…"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-gray-700">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-gray-700">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-medium text-gray-700">
                  Sales Employee (Code — Name)
                </label>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 bg-white"
                >
                  <option value="">All</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = formatYMDLocal(new Date());
                    setSearchText('');
                    setEmployeeFilter('');
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  className="w-full px-3 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[10px]"
                  title="Reset to today"
                >
                  Reset
                </button>
              </div>

              <div className="sm:col-span-12 flex flex-wrap gap-2 justify-end pt-1">
                <div className="text-[10px] text-gray-700 mr-auto">
                  Showing <span className="font-semibold">{filteredOrders.length}</span> order(s)
                </div>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="px-3 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[10px]"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={exportToExcelCSV}
                  className="px-3 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[10px]"
                >
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <section className="px-2 pb-4 pt-3 bg-white">
          <div className="mb-1 font-semibold text-[11px] px-2 text-gray-800">
            Order Status
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-1 py-1 text-left">S/N</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Order No.</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Customer Code</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Customer Name</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Sales Employee</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Shipping Address</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Product</th>
                  <th className="border border-gray-200 px-1 py-1 text-right">Quantity</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Delivery Date</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Delivery Time</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Status</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Action</th>
                  <th className="border border-gray-200 px-1 py-1 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading && (
                  <tr>
                    <td colSpan={13} className="px-2 py-2 text-center text-gray-500">
                      Loading orders…
                    </td>
                  </tr>
                )}
                {!ordersLoading && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-2 py-2 text-center text-gray-500">
                      No orders to display for the selected filters.
                    </td>
                  </tr>
                )}
                {!ordersLoading &&
                  filteredOrders.map((order, index) => {
                    const customerKey =
                      order.customerId ??
                      (typeof order.customer === 'object' ? order.customer?._id : order.customer);
                    const custFromMap = customerKey
                      ? customerById[String(customerKey)]
                      : null;
                    const custObj =
                      custFromMap ||
                      (typeof order.customer === 'object' ? order.customer : {}) ||
                      {};
                    const customerCode = custObj.custCd || order.custCd || '—';
                    const customerName = custObj.custName || order.custName || '—';
                    const firstItem =
                      Array.isArray(order.items) && order.items[0] ? order.items[0] : null;
                    const totalQty = Array.isArray(order.items)
                      ? order.items.reduce((s, it) => s + Number(it.quantity || 0), 0)
                      : '';
                    const statusLabel = order.orderStatus || 'PENDING';
                    const salesEmployeeLabel = getCreatedByLabel(order);
                    return (
                      <tr
                        key={order._id || index}
                        className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                      >
                        <td className="border border-gray-200 px-1 py-1">{index + 1}</td>
                        <td className="border border-gray-200 px-1 py-1">
                          {order.orderNo || (order._id ? order._id.slice(-6) : '—')}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">{customerCode}</td>
                        <td className="border border-gray-200 px-1 py-1">{customerName}</td>
                        <td className="border border-gray-200 px-1 py-1">{salesEmployeeLabel}</td>
                        <td className="border border-gray-200 px-1 py-1 max-w-xs truncate">
                          {order.shipToAddress || '—'}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          {firstItem?.productName || '—'}
                        </td>
                        <td className="border border-gray-200 px-1 py-1 text-right">
                          {totalQty || '—'}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          {order.deliveryDate ? String(order.deliveryDate).slice(0, 10) : '—'}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">
                          {order.deliveryTimeSlot || '—'}
                        </td>
                        <td className="border border-gray-200 px-1 py-1">{statusLabel}</td>
                        <td className="border border-gray-200 px-1 py-1 whitespace-nowrap">
                          <button
                            type="button"
                            className="underline text-blue-700 mr-2 text-[10px]"
                            onClick={() => handleEditOrder(order)}
                          >
                            Edit
                          </button>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="underline text-emerald-700 mr-2 text-[10px]"
                                onClick={() => handleSetOrderStatus(order, 'COMPLETED')}
                                disabled={statusLabel === 'COMPLETED'}
                                title="Mark as COMPLETED"
                              >
                                Complete
                              </button>
                              <button
                                type="button"
                                className="underline text-red-700 text-[10px]"
                                onClick={() => handleSetOrderStatus(order, 'CANCELLED')}
                                disabled={statusLabel === 'CANCELLED'}
                                title="Mark as CANCELLED"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="underline text-red-700 text-[10px]"
                              onClick={() => handleSetOrderStatus(order, 'CANCELLED')}
                              disabled={statusLabel === 'CANCELLED'}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                        <td className="border border-gray-200 px-1 py-1 text-[10px] max-w-xs">
                          {order.remarks && order.remarks.trim()
                            ? order.remarks
                            : statusLabel === 'CANCELLED'
                            ? 'Cancelled'
                            : statusLabel === 'COMPLETED'
                            ? 'Completed'
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setShowConfirm(false)}
          />
          <div className="relative z-10 w-[92%] max-w-md bg-white rounded-lg shadow-lg overflow-hidden text-sm">
            <div className="px-5 py-3 border-b flex items-center gap-2 bg-gray-50">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <h4 className="text-base font-semibold text-gray-800">
                {editingOrderId ? 'Confirm Update' : 'Confirm Order'}
              </h4>
            </div>
            <div className="px-5 py-4 text-xs space-y-2 bg-white">
              <p>
                Are you sure you want to {editingOrderId ? 'update' : 'create'} this order?
              </p>
              {pendingPayload && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1">
                  <div>
                    <span className="font-medium">Customer:</span>{' '}
                    {selectedCustomer?.custCd} — {selectedCustomer?.custName}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {pendingPayload.orderType}
                  </div>
                  <div>
                    <span className="font-medium">Delivery:</span> {pendingPayload.deliveryDate} (
                    {pendingPayload.deliveryTimeSlot})
                  </div>
                  {!editingOrderId && (
                    <div>
                      <span className="font-medium">Employee Code (empCd):</span>{' '}
                      {pendingPayload.empCd || '—'}
                    </div>
                  )}
                  {pendingPayload.remarks && (
                    <div>
                      <span className="font-medium">Remarks:</span>{' '}
                      {pendingPayload.remarks}
                    </div>
                  )}
                  <div className="font-medium">Items:</div>
                  <ul className="list-disc pl-5">
                    {pendingPayload.items.map((it, i) => (
                      <li key={i}>
                        {it.productName} — {it.quantity} L
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-1.5 rounded bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-xs text-gray-700"
              >
                <span className="inline-flex items-center gap-1">
                  <X size={14} /> Cancel
                </span>
              </button>
              <button
                onClick={confirmAndPost}
                disabled={loading}
                className="px-4 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 text-xs"
              >
                {loading
                  ? editingOrderId
                    ? 'Updating…'
                    : 'Submitting…'
                  : editingOrderId
                  ? 'Yes, Update Order'
                  : 'Yes, Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
