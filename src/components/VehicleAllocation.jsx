// src/components/FleetAllocation.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Truck, Search, Wrench, X, RefreshCcw } from "lucide-react";

const PRODUCT_MAP = [
  { test: /^(diesel|hsd)$/i, code: "101", name: "HSD", defaultUom: "L" },
  { test: /^(petrol|ms)$/i, code: "102", name: "MS", defaultUom: "L" },
];

const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

function deriveProductMeta(productName = "") {
  const found = PRODUCT_MAP.find((m) => m.test.test(String(productName)));
  if (!found) return { code: "", name: String(productName || "").toUpperCase(), defaultUom: "L" };
  return found;
}

function ddmmyyyy(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function yyyymmddInput(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getCurrentUserId() {
  const u = safeJsonParse(localStorage.getItem("user") || "");
  const candidates = [
    u?.userId,
    u?.empCd,
    u?.username,
    u?.loginId,
    u?.mobileNo,
    localStorage.getItem("userId"),
    localStorage.getItem("empCd"),
    localStorage.getItem("username"),
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : "Md100";
}

function getRoleText() {
  const u = safeJsonParse(localStorage.getItem("user") || "");
  const raw = (u?.userType ?? u?.role ?? localStorage.getItem("userType") ?? "a");
  const code = String(raw).toLowerCase();
  const map = { a: "Admin", e: "Executive", d: "Driver", va: "Vehicle Alloc", tr: "Trips", ac: "Accounts" };
  return map[code] || "Admin";
}

export default function FleetAllocation() {
  const navigate = useNavigate();

  const [ordersRaw, setOrdersRaw] = useState([]);
  const [rawById, setRawById] = useState({});
  const [fleetsRef, setFleetsRef] = useState([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState("");

  const [orderQuery, setOrderQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [fleetModalOrder, setFleetModalOrder] = useState(null);

  const [toast, setToast] = useState("");

  const userId = useMemo(getCurrentUserId, []);
  const roleText = useMemo(getRoleText, []);

  const fleetById = useMemo(() => {
    const m = {};
    for (const f of fleetsRef) m[String(f._id)] = f;
    return m;
  }, [fleetsRef]);

  const mapOrderToRow = useCallback(
    (o) => {
      const items = Array.isArray(o?.items) ? o.items : [];
      const first = items[0] || {};
      const meta = deriveProductMeta(first.productName);

      const fleetId = typeof o?.fleet === "string" ? o.fleet : o?.fleet?._id || null;

      const vNo =
        o?.fleet?.vehicle?.vehicleNo ||
        (fleetId && fleetById[fleetId]?.vehicle?.vehicleNo) ||
        "";

      const dNameFromFleetObj = o?.fleet?.driver
        ? (o.fleet.driver.driverName || o.fleet.driver.profile?.empName || "")
        : "";

      const dNameFromRef = fleetId
        ? (fleetById[fleetId]?.driver?.driverName || fleetById[fleetId]?.driver?.profile?.empName || "")
        : "";

      const driverName = dNameFromFleetObj || dNameFromRef || "";

      const deliveryISO = o?.deliveryDate ? new Date(o.deliveryDate).toISOString() : null;

      return {
        _id: o._id,
        orderNo: o?.orderNo || String(o?._id || "").slice(-6),
        userName: o?.empCd || "",
        custId: o?.customer?.custCd || "—",
        custName: o?.customer?.custName || "—",
        shipToLoc: o?.shipToAddress || o?.shipTo || "—",
        pdtCode: meta.code,
        pdtName: meta.name,
        pdtQty: Number(first.quantity || 0),
        uom: first.uom || meta.defaultUom || "L",
        pdtRate: Number(first.rate || 0),
        dateDely: deliveryISO,
        timeSlot: o?.deliveryTimeSlot || "—",
        orderStatus: o?.orderStatus || "PENDING",
        fleetId,
        vehicleRegNo: vNo,
        driverName,
      };
    },
    [fleetById]
  );

  const rows = useMemo(() => ordersRaw.map(mapOrderToRow), [ordersRaw, mapOrderToRow]);

  const selectedRow = useMemo(() => {
    if (!selectedOrderId) return null;
    return rows.find((r) => String(r._id) === String(selectedOrderId)) || null;
  }, [rows, selectedOrderId]);

  const fetchAll = useCallback(async () => {
    setOrdersLoading(true);
    setError("");
    try {
      const [ordersRes, fleetsRes] = await Promise.all([api.get("/orders"), api.get("/fleets")]);
      const fleetsArr = Array.isArray(fleetsRes.data) ? fleetsRes.data : [];
      const ordersArr = Array.isArray(ordersRes.data) ? ordersRes.data : [];

      setFleetsRef(fleetsArr);
      setOrdersRaw(ordersArr);

      const byId = {};
      for (const o of ordersArr) byId[o._id] = o;
      setRawById(byId);

      if (!selectedOrderId && ordersArr.length) setSelectedOrderId(ordersArr[0]._id);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load orders/fleets.");
      setOrdersRaw([]);
      setFleetsRef([]);
      setRawById({});
      setSelectedOrderId(null);
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    let temp = [...rows];

    if (orderQuery.trim()) {
      const s = orderQuery.trim().toLowerCase();
      temp = temp.filter(
        (o) =>
          (o.orderNo && String(o.orderNo).toLowerCase().includes(s)) ||
          (o.custName && o.custName.toLowerCase().includes(s)) ||
          (o.custId && String(o.custId).toLowerCase().includes(s)) ||
          (o.userName && String(o.userName).toLowerCase().includes(s)) ||
          (o.vehicleRegNo && o.vehicleRegNo.toLowerCase().includes(s)) ||
          (o.driverName && o.driverName.toLowerCase().includes(s))
      );
    }

    if (from) temp = temp.filter((o) => new Date(o.dateDely || 0) >= new Date(from));
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      temp = temp.filter((o) => new Date(o.dateDely || 0) <= end);
    }

    return temp.sort((a, b) =>
      a.orderStatus === "PENDING" && b.orderStatus !== "PENDING" ? -1 : 1
    );
  }, [rows, orderQuery, from, to]);

  const startEdit = useCallback((row) => {
    setEditingId(row._id);
    setEditForm({
      shipToLoc: row.shipToLoc,
      pdtQty: row.pdtQty,
      pdtRate: row.pdtRate,
      dateDely: yyyymmddInput(row.dateDely),
      timeSlot: row.timeSlot,
      orderStatus: row.orderStatus,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  const onChangeEdit = useCallback((field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
  }, []);

  const saveEdit = useCallback(
    async (id) => {
      try {
        const original = rawById[id];
        if (!original) throw new Error("Order not found");

        const items =
          Array.isArray(original.items) && original.items.length > 0
            ? original.items.map((it, idx) =>
                idx === 0
                  ? {
                      ...it,
                      quantity: Number(editForm.pdtQty || 0),
                      rate: Number(editForm.pdtRate || 0),
                    }
                  : it
              )
            : [
                {
                  productName: "diesel",
                  quantity: Number(editForm.pdtQty || 0),
                  rate: Number(editForm.pdtRate || 0),
                },
              ];

        const payload = {
          shipToAddress: editForm.shipToLoc,
          items,
          deliveryDate: editForm.dateDely || null,
          deliveryTimeSlot: editForm.timeSlot,
          orderStatus: editForm.orderStatus,
        };

        const res = await api.put(`/orders/${id}`, payload);
        const updated = res.data;

        setOrdersRaw((prev) => prev.map((o) => (String(o._id) === String(id) ? updated : o)));
        setRawById((prev) => ({ ...prev, [id]: updated }));

        setEditingId(null);
        setEditForm({});
        setToast("Order updated successfully.");
        window.setTimeout(() => setToast(""), 2500);
      } catch (e) {
        setToast("");
        window.alert(e?.response?.data?.error || "Failed to update order");
      }
    },
    [editForm, rawById]
  );

  const openFleetModal = useCallback(
    (row) => {
      const raw = rawById[row._id] || ordersRaw.find((o) => String(o._id) === String(row._id)) || null;
      setFleetModalOrder(raw);
      setFleetModalOpen(true);
    },
    [rawById, ordersRaw]
  );

  const closeFleetModal = useCallback(() => {
    setFleetModalOpen(false);
    setFleetModalOrder(null);
  }, []);

  const handleFleetAllocated = useCallback((updatedOrder) => {
    if (!updatedOrder?._id) return;
    setOrdersRaw((prev) => prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o)));
    setRawById((prev) => ({ ...prev, [updatedOrder._id]: updatedOrder }));
    setSelectedOrderId(updatedOrder._id);
    setToast("Fleet allocated successfully.");
    window.setTimeout(() => setToast(""), 2500);
  }, []);

  const releaseFleet = useCallback(
    async (row) => {
      try {
        const raw = rawById[row._id] || null;
        const fId = row.fleetId || (typeof raw?.fleet === "string" ? raw.fleet : raw?.fleet?._id) || null;
        if (!fId) {
          window.alert("No fleet assigned for this order.");
          return;
        }

        const res = await api.put(`/fleets/${fId}/release`, { orderId: row._id });
        const updatedOrder = res.data?.order || null;

        if (updatedOrder) {
          handleFleetAllocated(updatedOrder);
        } else {
          setOrdersRaw((prev) =>
            prev.map((o) =>
              String(o._id) === String(row._id)
                ? { ...o, fleet: null }
                : o
            )
          );
          setRawById((prev) => {
            const copy = { ...prev };
            if (copy[row._id]) copy[row._id] = { ...copy[row._id], fleet: null };
            return copy;
          });
          setToast("Fleet released successfully.");
          window.setTimeout(() => setToast(""), 2500);
        }
      } catch (e) {
        window.alert(e?.response?.data?.error || "Failed to release fleet");
      }
    },
    [rawById, handleFleetAllocated]
  );

  const handleHome = useCallback(() => navigate("/dashboard"), [navigate]);
  const handleBack = useCallback(() => navigate(-1), [navigate]);
  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  }, [navigate]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.orderStatus === "PENDING").length;
    const assigned = rows.filter((r) => r.vehicleRegNo || r.fleetId).length;
    return { total, pending, assigned };
  }, [rows]);

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto bg-white border border-black/30 shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/20">
          <div className="text-sm font-semibold">
            Welcome. <span className="font-extrabold">{userId}</span>! <span className="font-bold">FLEET MANAGER</span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleHome} className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-extrabold border border-black/40">
              Home
            </button>
            <button type="button" onClick={handleBack} className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-extrabold border border-black/40">
              Back
            </button>
            <button type="button" onClick={handleLogout} className="px-6 py-1.5 rounded bg-[#b85a1d] text-white font-extrabold border border-black/40">
              Log Out
            </button>
            <span className="ml-2 text-red-600 font-extrabold">{roleText}</span>
          </div>
        </div>

        {/* Title row */}
        <div className="relative px-4 py-4 border-b border-black/10">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-wide">DRIVER ASSIGNMENT</div>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 select-none text-2xl sm:text-3xl font-extrabold">
            <span className="text-orange-600">fuel</span>
            <span className="text-purple-700">wale</span>
          </div>
        </div>

        {/* Section buttons */}
        <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-center gap-4 border-b border-black/10">
          <button
            type="button"
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-[#0d6078] text-white font-extrabold border-2 border-[#084253]"
          >
            Vehicle Assignment
          </button>

          <button
            type="button"
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-[#0d6078] text-white font-extrabold border-2 border-[#084253]"
            onClick={() => document.getElementById("allocation-table")?.scrollIntoView({ behavior: "smooth" })}
          >
            View All Assigned / Not Assigned
          </button>

          <button
            type="button"
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-[#0d6078] text-white font-extrabold border-2 border-[#084253]"
            onClick={() => setOrderQuery("PENDING")}
          >
            Status
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="px-4 py-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded px-3 py-2 font-semibold">
              {toast}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <div className="bg-red-50 border border-red-200 text-red-900 rounded px-3 py-2 font-semibold">
              {error}
            </div>
          </div>
        )}

        {/* Green assignment panel */}
        <div className="m-4 border-2 border-black/40 bg-[#c9f3cd]">
          <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-black/20">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-300 px-3 py-1 font-extrabold text-sm border border-black/30">
                Order Search
              </div>
              <div className="relative w-full sm:w-[420px]">
                <input
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="By Order No / Customer / Vehicle / Driver"
                  className="w-full border border-black/20 bg-white rounded pl-9 pr-3 py-2 text-sm"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-end">
              <div className="text-sm font-semibold">
                Total: <span className="font-extrabold">{stats.total}</span>{" "}
                <span className="mx-2">|</span>
                Pending: <span className="font-extrabold">{stats.pending}</span>{" "}
                <span className="mx-2">|</span>
                Assigned: <span className="font-extrabold">{stats.assigned}</span>
              </div>

              <button
                type="button"
                onClick={fetchAll}
                className="inline-flex items-center gap-2 border-2 border-black/30 px-3 py-2 rounded bg-white font-extrabold"
                title="Refresh"
              >
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
          </div>

          <div className="px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Selected order details */}
            <div className="lg:col-span-7 border border-black/20 bg-white/60 p-4">
              <div className="font-extrabold mb-3">Assignment</div>

              {!selectedRow ? (
                <div className="text-sm text-gray-700">Select an order from the list below to view details.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Detail label="Order No." value={selectedRow.orderNo} />
                  <Detail label="Customer" value={`${selectedRow.custId} - ${selectedRow.custName}`} />
                  <Detail label="Ship To" value={selectedRow.shipToLoc} />
                  <Detail label="Product" value={`${selectedRow.pdtName} (${selectedRow.pdtCode || "—"})`} />
                  <Detail label="Qty" value={`${selectedRow.pdtQty} ${selectedRow.uom}`} />
                  <Detail label="Delivery" value={`${ddmmyyyy(selectedRow.dateDely)} • ${selectedRow.timeSlot}`} />
                  <Detail
                    label="Vehicle"
                    value={selectedRow.vehicleRegNo ? selectedRow.vehicleRegNo : "—"}
                  />
                  <Detail
                    label="Driver"
                    value={selectedRow.driverName ? selectedRow.driverName : "—"}
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectedRow && openFleetModal(selectedRow)}
                  disabled={!selectedRow}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded border-2 font-extrabold ${
                    selectedRow ? "bg-[#0d6078] text-white border-[#084253] hover:bg-[#0f6f8b]" : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                >
                  <Wrench size={16} />
                  Modify Fleet
                </button>

                <button
                  type="button"
                  onClick={() => selectedRow && releaseFleet(selectedRow)}
                  disabled={!selectedRow || (!selectedRow.fleetId && !selectedRow.vehicleRegNo)}
                  className={`px-4 py-2 rounded border-2 font-extrabold ${
                    selectedRow && (selectedRow.fleetId || selectedRow.vehicleRegNo)
                      ? "bg-white text-red-700 border-red-300 hover:bg-red-50"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                >
                  Release
                </button>
              </div>
            </div>

            {/* Date filters */}
            <div className="lg:col-span-5 border border-black/20 bg-white/60 p-4">
              <div className="font-extrabold mb-3">Date Filter</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold mb-1">From</div>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold mb-1">To</div>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 border-t border-black/10 pt-3 text-xs text-black/70">
                Search supports Order No, Customer Code/Name, Vehicle No and Driver Name.
              </div>
            </div>
          </div>
        </div>

        {/* Purple list panel */}
        <div id="allocation-table" className="m-4 border-2 border-black/40 bg-[#e3a3dc]">
          <div className="px-4 py-2 border-b border-black/20">
            <div className="text-center font-extrabold">All Orders / Fleet Assignment</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full border-collapse">
              <thead>
                <tr className="bg-[#f3c7a2] text-black border-b-2 border-black/40">
                  <th className="px-3 py-2 text-left">S/n</th>
                  <th className="px-3 py-2 text-left">Order No.</th>
                  <th className="px-3 py-2 text-left">Cust Code</th>
                  <th className="px-3 py-2 text-left">Customer Name</th>
                  <th className="px-3 py-2 text-left">Vehicle Assigned</th>
                  <th className="px-3 py-2 text-left">Driver</th>
                  <th className="px-3 py-2 text-left">Delivery Date</th>
                  <th className="px-3 py-2 text-left">Delivery Time</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {ordersLoading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center font-semibold">
                      Loading…
                    </td>
                  </tr>
                )}

                {!ordersLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center font-semibold">
                      No records found.
                    </td>
                  </tr>
                )}

                {!ordersLoading &&
                  filtered.map((row, idx) => {
                    const isEditing = editingId === row._id;
                    const active = selectedOrderId && String(selectedOrderId) === String(row._id);

                    return (
                      <tr
                        key={row._id}
                        className={`border-t border-black/20 cursor-pointer ${active ? "bg-white/40" : ""}`}
                        onClick={() => setSelectedOrderId(row._id)}
                      >
                        <td className="px-3 py-2">{idx + 1}</td>

                        <td className="px-3 py-2 font-mono">{row.orderNo || "—"}</td>

                        <td className="px-3 py-2">{row.custId || "—"}</td>

                        <td className="px-3 py-2">{row.custName || "—"}</td>

                        <td className="px-3 py-2">
                          {row.vehicleRegNo ? (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-green-200/80 border border-green-300 font-mono text-xs">
                              {row.vehicleRegNo}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-3 py-2">{row.driverName || "—"}</td>

                        <td className="px-3 py-2">{ddmmyyyy(row.dateDely)}</td>

                        <td className="px-3 py-2">{row.timeSlot || "—"}</td>

                        <td className="px-3 py-2">{row.orderStatus || "—"}</td>

                        <td className="px-3 py-2">
                          {!isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openFleetModal(row);
                                }}
                                className="px-3 py-1.5 rounded bg-[#0d6078] text-white font-extrabold border-2 border-[#084253] hover:bg-[#0f6f8b]"
                              >
                                Modify
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  releaseFleet(row);
                                }}
                                disabled={!row.fleetId && !row.vehicleRegNo}
                                className={`px-3 py-1.5 rounded font-extrabold border-2 ${
                                  row.fleetId || row.vehicleRegNo
                                    ? "bg-white text-red-700 border-red-300 hover:bg-red-50"
                                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                }`}
                              >
                                Release
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(row);
                                }}
                                className="px-3 py-1.5 rounded bg-white text-black font-extrabold border-2 border-black/30 hover:bg-white/60"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEdit(row._id);
                                }}
                                className="px-3 py-1.5 rounded bg-white text-emerald-800 font-extrabold border-2 border-emerald-300 hover:bg-emerald-50"
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                className="px-3 py-1.5 rounded bg-white text-black font-extrabold border-2 border-black/30 hover:bg-white/60"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {editingId && (
            <div className="px-4 py-4 border-t border-black/20 bg-white/20">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <div className="text-xs font-extrabold mb-1">Ship To</div>
                  <input
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                    value={editForm.shipToLoc || ""}
                    onChange={(e) => onChangeEdit("shipToLoc", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs font-extrabold mb-1">Qty</div>
                  <input
                    type="number"
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm text-right"
                    value={editForm.pdtQty ?? ""}
                    onChange={(e) => onChangeEdit("pdtQty", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs font-extrabold mb-1">Rate</div>
                  <input
                    type="number"
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm text-right"
                    value={editForm.pdtRate ?? ""}
                    onChange={(e) => onChangeEdit("pdtRate", e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="text-xs font-extrabold mb-1">Delivery Date</div>
                  <input
                    type="date"
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                    value={editForm.dateDely || ""}
                    onChange={(e) => onChangeEdit("dateDely", e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="text-xs font-extrabold mb-1">Time Slot</div>
                  <input
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                    value={editForm.timeSlot || ""}
                    onChange={(e) => onChangeEdit("timeSlot", e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="text-xs font-extrabold mb-1">Status</div>
                  <input
                    className="w-full border border-black/20 rounded px-3 py-2 bg-white text-sm"
                    value={editForm.orderStatus || ""}
                    onChange={(e) => onChangeEdit("orderStatus", e.target.value)}
                  />
                </div>

                <div className="md:col-span-12 text-xs text-black/70">
                  Editing applies to the currently selected row.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FleetPicker
        open={fleetModalOpen}
        onClose={closeFleetModal}
        order={fleetModalOrder}
        onAllocated={handleFleetAllocated}
      />
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-black/70">{label}</div>
      <div className="font-semibold break-words">{value || "—"}</div>
    </div>
  );
}

/* ========================= Fleet Picker Modal ========================= */

function FleetPicker({ open, onClose, order, onAllocated }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const vehicleByNo = useMemo(() => {
    const m = {};
    for (const f of list || []) {
      const vNo =
        f?.vehicle?.vehicleNo ||
        f?.vehicle?.regNo ||
        f?.vehicle?.registrationNo ||
        "";
      if (vNo) m[norm(vNo)] = true;
    }
    return m;
  }, [list]);

  const fetchFleets = useCallback(async (term) => {
    setLoading(true);
    try {
      const res = await api.get("/fleets", { params: { search: term || "" } });
      setList(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    fetchFleets("");
  }, [open, fetchFleets]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => fetchFleets(q), 250);
    return () => window.clearTimeout(t);
  }, [q, open, fetchFleets]);

  const doAllocate = useCallback(
    async (fleet) => {
      try {
        setBusyId(fleet._id);
        const res = await api.put(`/fleets/${fleet._id}/allocate`, { orderId: order?._id });
        const updatedOrder = res.data?.order || res.data;
        onAllocated?.(updatedOrder);
        onClose?.();
      } catch (e) {
        const msg =
          e?.response?.data?.error ||
          (e?.response?.status === 409 ? "Fleet already allocated." : "Failed to allocate fleet.");
        window.alert(msg);
      } finally {
        setBusyId(null);
      }
    },
    [order, onAllocated, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[min(860px,96vw)] bg-white border-2 border-black/30 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/20 bg-[#c9f3cd]">
          <div className="flex items-center gap-2 font-extrabold">
            <Truck size={18} />
            Allocate Fleet
          </div>
          <button type="button" className="p-1 rounded hover:bg-white/70" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="text-sm">
              <span className="font-extrabold">Order:</span>{" "}
              <span className="font-mono">{order?.orderNo || String(order?._id || "").slice(-6) || "—"}</span>
              <span className="mx-2">|</span>
              <span className="font-extrabold">Customer:</span>{" "}
              {order?.customer?.custName || "—"}
            </div>

            <div className="relative w-full md:w-[420px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search fleet (vehicle / driver / depot)…"
                className="w-full border border-black/20 rounded pl-9 pr-3 py-2 text-sm"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto border border-black/20">
            {loading && <div className="py-10 text-center font-semibold">Loading fleets…</div>}

            {!loading && list.length === 0 && (
              <div className="py-10 text-center font-semibold">No fleets found.</div>
            )}

            {!loading &&
              list.map((f) => {
                const v = f.vehicle || {};
                const d = f.driver || {};
                const driverName = d.driverName || d.profile?.empName || "";
                const vehicleNo = v.vehicleNo || v.regNo || v.registrationNo || "";
                const depot = f.depotCd || v.depotCd || "";
                const cap = v.calibratedCapacity || v.capacity || "";

                const inUse = Boolean(f.isAllocated || f.allocated || f.currentOrderId);

                return (
                  <div key={f._id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10">
                    <div className="min-w-0">
                      <div className="font-extrabold">
                        {vehicleNo || "(no vehicle)"}{" "}
                        {vehicleNo && vehicleByNo[norm(vehicleNo)] ? "" : ""}
                      </div>
                      <div className="text-sm text-black/70">
                        <span className="font-semibold">Driver:</span> {driverName || "—"}
                        {depot ? <span> • <span className="font-semibold">Depot:</span> {depot}</span> : null}
                        {cap ? <span> • <span className="font-semibold">Cap:</span> {cap}</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inUse ? (
                        <span className="text-xs px-2 py-1 rounded border-2 border-red-300 bg-red-50 text-red-800 font-extrabold">
                          IN USE
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => doAllocate(f)}
                          disabled={busyId === f._id}
                          className="px-4 py-2 rounded bg-[#0d6078] text-white font-extrabold border-2 border-[#084253] hover:bg-[#0f6f8b] disabled:opacity-60"
                        >
                          {busyId === f._id ? "Allocating…" : "Allocate"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded bg-white text-black font-extrabold border-2 border-black/30 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
