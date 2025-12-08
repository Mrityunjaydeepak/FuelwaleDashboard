// src/components/ManageOrders.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  ShoppingCart,
  PlusIcon,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';

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
  };

  const [form, setForm] = useState(initialForm);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // are we editing an existing order?
  const [editingOrderId, setEditingOrderId] = useState(null);

  // selected ship-to key: 'shipTo1'..'shipTo5'
  const [shipToChoice, setShipToChoice] = useState('shipTo1');

  // logged-in user
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('');

  // ---- USER INFO (tries multiple common storage patterns so it's not blank) ----
  useEffect(() => {
    let id = '';
    let type = '';

    const rawUser =
      localStorage.getItem('user') ||
      localStorage.getItem('currentUser') ||
      localStorage.getItem('loggedInUser');

    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        id =
          u.userId ||
          u.username ||
          u.name ||
          u.loginId ||
          id;
        type =
          u.userType ||
          u.type ||
          u.role ||
          type;
      } catch {
        // ignore JSON errors and just fall back to simple keys
      }
    }

    if (!id) {
      id =
        localStorage.getItem('userId') ||
        localStorage.getItem('userName') ||
        localStorage.getItem('username') ||
        '';
    }
    if (!type) {
      type =
        localStorage.getItem('userType') ||
        localStorage.getItem('role') ||
        localStorage.getItem('userRole') ||
        '';
    }

    setCurrentUserId(id);
    setCurrentUserType(type);
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

  const selectedCustomer = useMemo(
    () =>
      customers.find((c) => String(c._id) === String(form.customerId)) || null,
    [customers, form.customerId]
  );

  const customerById = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      map[String(c._id)] = c;
    });
    return map;
  }, [customers]);

  // --- helpers to build ship-to options -----------------------------

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

  // --- load data ----------------------------------------------------

  // Load customers
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

  // Load existing orders for status grid
  useEffect(() => {
    let alive = true;
    setOrdersLoading(true);
    api
      .get('/orders')
      .then((res) => {
        if (!alive) return;
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        // keep silent for list errors; form errors still go via `error`
      })
      .finally(() => {
        if (alive) setOrdersLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // When customer changes, pick first non-empty address (fallback to Address 1)
  // BUT do not override when editing an existing order
  useEffect(() => {
    if (editingOrderId) return;

    if (!selectedCustomer) {
      setShipToChoice('shipTo1');
      setForm((f) => ({ ...f, shipToAddress: '' }));
      return;
    }
    if (shipToOptions.length) {
      const firstNonEmpty =
        shipToOptions.find((o) => !o.empty) || shipToOptions[0];
      setShipToChoice(firstNonEmpty.key);
      setForm((f) => ({ ...f, shipToAddress: firstNonEmpty.value }));
    }
  }, [selectedCustomer, shipToOptions, editingOrderId]);

  // --- nav handlers -------------------------------------------------

  const handleHome = () => {
    navigate('/'); // adjust if your dashboard route is different
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = () => {
    // clear whatever auth you use
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    navigate('/login'); // adjust to your login route
  };

  // --- form handlers -----------------------------------------------

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
      if (f.items.length === 1) return f; // keep at least one
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items };
    });
  };

  const handleShipToChoiceChange = (key) => {
    setShipToChoice(key);
    const opt = shipToOptions.find((o) => o.key === key);
    setForm((f) => ({ ...f, shipToAddress: opt ? opt.value : '' }));
  };

  const handleSubmit = async (e) => {
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
      // backend probably maps this to the `customer` ObjectId
      customerId: form.customerId,
      shipToAddress: form.shipToAddress,
      orderType: form.orderType,
      items: cleanedItems,
      deliveryDate: form.deliveryDate,
      deliveryTimeSlot,
    };

    setPendingPayload(payload);
    setShowConfirm(true);
  };

  // Handle create / update based on editingOrderId
  const confirmAndPost = async () => {
    if (!pendingPayload) return;
    setLoading(true);
    try {
      let res;
      if (editingOrderId) {
        // UPDATE existing order
        res = await api.put(`/orders/${editingOrderId}`, pendingPayload);
        if (res?.data) {
          setOrders((prev) =>
            prev.map((o) =>
              o._id === editingOrderId ? { ...o, ...res.data } : o
            )
          );
        } else {
          // if no body, at least merge payload locally
          setOrders((prev) =>
            prev.map((o) =>
              o._id === editingOrderId ? { ...o, ...pendingPayload } : o
            )
          );
        }
      } else {
        // CREATE new order
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

  // ---- EDIT / CANCEL handlers for order rows ------------------------

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
            quantity:
              it.quantity !== undefined && it.quantity !== null
                ? String(it.quantity)
                : '',
          }))
        : [{ productName: 'diesel', quantity: '' }];

    setForm({
      customerId,
      shipToAddress: order.shipToAddress || '',
      items,
      deliveryDate: order.deliveryDate
        ? String(order.deliveryDate).slice(0, 10) // ensure yyyy-mm-dd if ISO
        : '',
      deliveryTimeStart,
      deliveryTimeEnd,
      orderType: order.orderType || 'Regular',
    });

    setShipToChoice('shipTo1');
  };

  const handleCancelOrder = async (order) => {
    if (!order?._id) return;
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    try {
      // according to your schema, field name is orderStatus and value is "CANCELLED"
      const res = await api.put(`/orders/${order._id}`, {
        orderStatus: 'CANCELLED',
      });
      const serverOrder = res?.data;

      setOrders((prev) =>
        prev.map((o) => {
          if (o._id !== order._id) return o;

          // merge so we don't lose existing fields
          let merged = serverOrder
            ? { ...o, ...serverOrder }
            : { ...o, orderStatus: 'CANCELLED' };

          // if we had a populated customer object before, and now server only sent an id,
          // keep the populated object
          if (
            o.customer &&
            typeof o.customer === 'object' &&
            merged.customer &&
            typeof merged.customer !== 'object'
          ) {
            merged.customer = o.customer;
          }

          return merged;
        })
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel order.');
    }
  };

  const activeCustomers = customers.filter((c) => c.status === 'Active');
  const inactiveCustomers = customers.filter((c) => c.status !== 'Active');

  const totalQuantity = useMemo(() => {
    return form.items.reduce((sum, it) => {
      const q = Number(it.quantity || 0);
      return sum + (isFinite(q) ? q : 0);
    }, 0);
  }, [form.items]);

  // --- render -------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto bg-white border border-gray-300 shadow-sm text-[11px] sm:text-xs">
        {/* Main title */}
        <header className="border-b border-gray-300 px-4 py-3">
          <h1 className="text-center font-semibold tracking-wide text-base sm:text-lg">
            ORDER SUBMISSION BY ALL USERS &amp; STATUS UPDATE
          </h1>
        </header>

        {/* Welcome + top nav */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-1.5 border-b border-gray-300 bg-gray-50">
          <div className="text-[10px] sm:text-[11px]">
            Welcome, {displayName}!
            {roleLabel && (
              <>
                {' '}
                ({roleLabel})
              </>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleHome}
              className="px-3 py-1 border border-gray-400 rounded-sm text-[10px] bg-orange-400 text-white hover:bg-orange-500"
            >
              Home
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-3 py-1 border border-gray-400 rounded-sm text-[10px] bg-orange-400 text-white hover:bg-orange-500"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1 border border-gray-400 rounded-sm text-[10px] bg-orange-400 text-white hover:bg-orange-500"
            >
              Log Out
            </button>
            <button
              type="button"
              className="px-3 py-1 text-[10px] text-red-600 underline"
            >
              Admin
            </button>
          </div>
        </div>

        {/* ORDER MANAGEMENT header + top buttons */}
        <section className="border-b border-gray-300 px-4 py-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2">
              <ShoppingCart size={16} />
              <h2 className="font-semibold text-sm sm:text-base">
                ORDER MANAGEMENT
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-[11px]">
            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-sm flex items-center gap-1">
              <PlusIcon size={14} /> Add Order
            </button>
            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-sm">
              View All Orders
            </button>
            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-sm text-center">
              View Individual Open / Closed / Cancelled Orders
            </button>
          </div>
        </section>

        {/* FORM AREA – green block */}
        <form onSubmit={handleSubmit}>
          <section className="bg-green-100 border-b border-gray-300 px-4 py-4 space-y-4">
            {/* mapped depot + search customer */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex gap-2 items-baseline">
                  <span className="font-medium">Mapped Depot Code</span>
                  {/* Customer model: depotCd */}
                  <span className="font-semibold">
                    {selectedCustomer?.depotCd || '—'}
                  </span>
                  <span className="ml-4 font-medium">Name</span>
                  {/* No depotName in model, showing customer name as depot name for now */}
                  <span className="font-semibold">
                    {selectedCustomer?.custName || '—'}
                  </span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="font-medium">Selected Customer</span>
                  <span className="font-semibold">
                    {selectedCustomer?.custCd || '—'}
                  </span>
                  <span className="ml-4 font-medium">Name</span>
                  <span className="font-semibold">
                    {selectedCustomer?.contactPerson || '—'}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <div className="inline-block bg-yellow-300 px-3 py-1 text-[11px] font-semibold rounded-sm">
                  Search Customer
                </div>
                <div className="mt-2">
                  <select
                    name="customerId"
                    value={form.customerId}
                    onChange={handleFormChange}
                    className="w-full border border-gray-400 rounded-sm px-2 py-1 bg-white"
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
                  <div className="mt-1 text-[10px] text-gray-600">
                    Search by Name / Customer Code with a date filter for order
                    view.
                  </div>
                </div>
              </div>
            </div>

            {/* Order type + ship to addresses */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 space-y-2">
                <div className="font-medium">
                  Order Type{' '}
                  <span className="font-normal">(Regular / Express)</span>
                </div>
                <div className="flex gap-3 mt-1">
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
                  <div className="font-medium mb-1">
                    Select Shipping Address 1 / 2 / 3 / ...
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
                    {shipToOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={opt.empty}
                        onClick={() => handleShipToChoiceChange(opt.key)}
                        className={`text-left border rounded-sm px-2 py-1 h-full ${
                          shipToChoice === opt.key
                            ? 'border-blue-600 ring-1 ring-blue-400 bg-white'
                            : 'border-gray-400 bg-gray-50'
                        } ${opt.empty ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-semibold truncate">
                          Area {opt.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  <textarea
                    readOnly
                    value={form.shipToAddress}
                    className="mt-2 w-full border border-gray-400 rounded-sm px-2 py-1 bg-white text-[11px]"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Product / items line */}
            <div className="border-t border-gray-300 pt-3 space-y-2">
              <div className="font-medium mb-1">Product Details</div>
              <div className="space-y-1">
                {form.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-5 sm:col-span-4">
                      <label className="block text-[10px] font-medium">
                        Product Name
                      </label>
                      <input
                        name="productName"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, e)}
                        className="w-full border border-gray-400 rounded-sm px-2 py-1 bg-white"
                        placeholder="Diesel"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-4">
                      <label className="block text-[10px] font-medium">
                        Quantity (L)
                      </label>
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, e)}
                        className="w-full border border-gray-400 rounded-sm px-2 py-1 text-right"
                        required
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-4 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={form.items.length === 1}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-gray-400 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-40"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-sm text-[11px]"
                >
                  <PlusIcon size={12} /> Add Item
                </button>
                <div className="text-[11px] text-gray-700">
                  <span className="font-semibold">Total Quantity: </span>
                  {totalQuantity} L
                </div>
              </div>
            </div>

            {/* Delivery date & time */}
            <div className="border-t border-gray-300 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-medium">
                  Delivery Date
                </label>
                <input
                  type="date"
                  name="deliveryDate"
                  value={form.deliveryDate}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-400 rounded-sm px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium">
                  Time From
                </label>
                <input
                  type="time"
                  name="deliveryTimeStart"
                  value={form.deliveryTimeStart}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-400 rounded-sm px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium">
                  Time To
                </label>
                <input
                  type="time"
                  name="deliveryTimeEnd"
                  value={form.deliveryTimeEnd}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-400 rounded-sm px-2 py-1 bg-white"
                />
              </div>
            </div>

            {/* Errors + submit */}
            {error && (
              <div className="mt-2 text-red-600 text-[11px] font-medium">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-700 text-white rounded-sm text-[11px] font-semibold hover:bg-blue-800 disabled:opacity-60"
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

        {/* Search Order bar (bottom of green area in layout) */}
        <div className="border-b border-gray-300 px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-yellow-200">
          <div className="font-semibold text-[11px]">Search Orders</div>
          <div className="text-[10px] text-gray-700">
            Search by Order No. / Customer Code / Name with a date filter.
          </div>
        </div>

        {/* ORDER STATUS GRID */}
        <section className="px-2 pb-4 pt-3">
          <div className="mb-1 font-semibold text-[11px] px-2">
            Order Status
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border border-gray-300">
              <thead>
                <tr className="bg-pink-200">
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    S/N
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Order No.
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Customer Code
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Customer Name
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Shipping Address
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Product
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-right">
                    Quantity
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Delivery Date
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Delivery Time
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Status
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Action
                  </th>
                  <th className="border border-gray-300 px-1 py-1 text-left">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-2 py-2 text-center text-gray-500"
                    >
                      Loading orders…
                    </td>
                  </tr>
                )}

                {!ordersLoading && orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-2 py-2 text-center text-gray-500"
                    >
                      No orders to display yet.
                    </td>
                  </tr>
                )}

                {!ordersLoading &&
                  orders.map((order, index) => {
                    // derive a key we can use to look up from customerById
                    const customerKey =
                      order.customerId ??
                      (typeof order.customer === 'object'
                        ? order.customer?._id
                        : order.customer);

                    const custFromMap = customerKey
                      ? customerById[String(customerKey)]
                      : null;

                    const custObj =
                      custFromMap ||
                      (typeof order.customer === 'object' ? order.customer : {}) ||
                      {};

                    const customerCode =
                      custObj.custCd || order.custCd || '—';
                    const customerName =
                      custObj.custName || order.custName || '—';

                    const firstItem =
                      Array.isArray(order.items) && order.items[0]
                        ? order.items[0]
                        : null;
                    const totalQty = Array.isArray(order.items)
                      ? order.items.reduce(
                          (s, it) => s + Number(it.quantity || 0),
                          0
                        )
                      : '';

                    // Use orderStatus as per your schema, default PENDING
                    const statusLabel = order.orderStatus || 'PENDING';

                    return (
                      <tr
                        key={order._id || index}
                        className={index % 2 === 0 ? 'bg-pink-100' : 'bg-pink-50'}
                      >
                        <td className="border border-gray-300 px-1 py-1">
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {order.orderNo ||
                            (order._id ? order._id.slice(-6) : '—')}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {customerCode}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {customerName}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 max-w-xs truncate">
                          {order.shipToAddress || '—'}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {firstItem?.productName || '—'}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-right">
                          {totalQty || '—'}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {order.deliveryDate
                            ? String(order.deliveryDate).slice(0, 10)
                            : '—'}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {order.deliveryTimeSlot || '—'}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {statusLabel}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 whitespace-nowrap">
                          <button
                            type="button"
                            className="underline text-blue-700 mr-1 text-[10px]"
                            onClick={() => handleEditOrder(order)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="underline text-red-700 text-[10px]"
                            onClick={() => handleCancelOrder(order)}
                          >
                            Cancel
                          </button>
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-[10px]">
                          {statusLabel === 'CANCELLED'
                            ? 'Cancelled - No storage available'
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

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setShowConfirm(false)}
          />
          <div className="relative z-10 w-[92%] max-w-md bg-white rounded-lg shadow-lg overflow-hidden text-sm">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <h4 className="text-base font-semibold">
                {editingOrderId ? 'Confirm Update' : 'Confirm Order'}
              </h4>
            </div>
            <div className="px-5 py-4 text-xs space-y-2">
              <p>
                Are you sure you want to{' '}
                {editingOrderId ? 'update' : 'create'} this order?
              </p>
              {pendingPayload && (
                <div className="bg-gray-50 border rounded p-3 space-y-1">
                  <div>
                    <span className="font-medium">Customer:</span>{' '}
                    {selectedCustomer?.custCd} — {selectedCustomer?.custName}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span>{' '}
                    {pendingPayload.orderType}
                  </div>
                  <div>
                    <span className="font-medium">Delivery:</span>{' '}
                    {pendingPayload.deliveryDate} (
                    {pendingPayload.deliveryTimeSlot})
                  </div>
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
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-1.5 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-xs"
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
