import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Truck, Search, Wrench, X, RefreshCcw } from "lucide-react";

/**
 * FleetAllocation.jsx
 * - Lists orders (GET /orders)
 * - Fleet picker (GET /fleets?search=) → allocate (PUT /fleets/:id/allocate { orderId })
 * - Release fleet (PUT /fleets/:id/release { orderId })
 *
 * Assumptions:
 *   Order: _id, orderNo?, customer{custCd,custName}, shipToAddress, items[], deliveryDate, deliveryTimeSlot,
 *          fleet?(id or populated), orderStatus?
 *   Fleet: _id, vehicle{_id, vehicleNo, calibratedCapacity?, depotCd?}, driver{_id, driverName, profile{empName?}}
 */

const PRODUCT_MAP = [
  { test: /^(diesel|hsd)$/i, code: "101", name: "HSD", defaultUom: "L" },
  { test: /^(petrol|ms)$/i, code: "102", name: "MS", defaultUom: "L" },
];

const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

function deriveProductMeta(productName = "") {
  const found = PRODUCT_MAP.find((m) => m.test.test(String(productName)));
  if (!found) {
    return {
      code: "",
      name: String(productName || "").toUpperCase(),
      defaultUom: "L",
    };
  }
  return found;
}
function ddmmyyyy(date) {
  if (!date) return "";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function yyyymmddInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export default function FleetAllocation() {
  // -------- data state ----------
  const [orders, setOrders] = useState([]);
  const [rawById, setRawById] = useState({});
  const [fleetsRef, setFleetsRef] = useState([]); // for lookups

  // -------- ui state ----------
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [orderQuery, setOrderQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // fleet modal
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [fleetModalOrder, setFleetModalOrder] = useState(null);

  // debug panel
  const [lastUpdatedOrder, setLastUpdatedOrder] = useState(null);

  // ------- memo helpers -------
  const fleetById = useMemo(() => {
    const m = {};
    for (const f of fleetsRef) m[String(f._id)] = f;
    return m;
  }, [fleetsRef]);

  // tolerant getters
  const getOrderNo = (o) => o?.orderNo || o?._id || "—";
  const getCustomerCd = (o) => o?.customer?.custCd || "—";
  const getCustomerName = (o) => o?.customer?.custName || "—";
  const getShipTo = (o) => o?.shipToAddress || o?.shipTo || "—";
  const getFirstItem = (o) =>
    Array.isArray(o?.items) && o.items.length ? o.items[0] : null;
  const getDeliveryDate = (o) =>
    o?.deliveryDate ? new Date(o.deliveryDate).toISOString() : null;
  const getTimeSlot = (o) => o?.deliveryTimeSlot || "—";

  const getFleetId = (o) =>
    typeof o?.fleet === "string" ? o.fleet : o?.fleet?._id || null;

  const getFleetVehicleNo = (o) => {
    if (o?.fleet?.vehicle?.vehicleNo) return o.fleet.vehicle.vehicleNo;
    const id = getFleetId(o);
    return id && fleetById[id]?.vehicle?.vehicleNo
      ? fleetById[id].vehicle.vehicleNo
      : "";
  };

  const getFleetDriverName = (o) => {
    if (o?.fleet?.driver) {
      const d = o.fleet.driver;
      return d.driverName || d.profile?.empName || "";
    }
    const id = getFleetId(o);
    const d = id ? fleetById[id]?.driver : null;
    return d ? d.driverName || d.profile?.empName || "" : "";
  };

  // ================= data fetch =================
  const fetchAll = async () => {
    setOrdersLoading(true);
    setError("");
    try {
      const [ordersRes, fleetsRes] = await Promise.all([
        api.get("/orders"),
        api.get("/fleets"),
      ]);

      setFleetsRef(Array.isArray(fleetsRes.data) ? fleetsRes.data : []);

      const ordersArr = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const byId = {};
      ordersArr.forEach((o) => (byId[o._id] = o));
      setRawById(byId);

      setOrders(mapOrdersToRows(ordersArr));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load orders/fleets.");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line 

  }, []);

  // refresh mapped fleet fields when fleetsRef changes
  useEffect(() => {
    if (!orders.length) return;
    setOrders((prev) => mapOrdersToRows(prev, true));
    // eslint-disable-next-line 

  }, [fleetById]);

  function mapOrdersToRows(list, skipRaw = false) {
    return list.map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const first = items[0] || {};
      const meta = deriveProductMeta(first.productName);

      const fId = getFleetId(o);
      const vNo = getFleetVehicleNo(o);
      const dName = getFleetDriverName(o);

      return {
        _id: o._id,
        orderNo: getOrderNo(o),
        userName: o.empCd || "",
        userType: o.userType || "",
        custId: getCustomerCd(o),
        custName: getCustomerName(o),
        shipToLoc: getShipTo(o),
        pdtCode: meta.code,
        pdtName: meta.name,
        pdtQty: Number(first.quantity || 0),
        uom: first.uom || meta.defaultUom || "L",
        pdtRate: Number(first.rate || 0),
        dateDely: getDeliveryDate(o),
        timeSlot: getTimeSlot(o),
        orderStatus: o.orderStatus || "PENDING",
        fleetId: fId,
        vehicleRegNo: vNo || "",
        driverName: dName || "",
        _raw: skipRaw ? o._raw || o : o,
      };
    });
  }

  // ============ client filters ============
  const filtered = useMemo(() => {
    let temp = [...orders];
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
    if (from)
      temp = temp.filter(
        (o) => new Date(o.dateDely || o.createdAt) >= new Date(from)
      );
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      temp = temp.filter((o) => new Date(o.dateDely || o.createdAt) <= end);
    }
    return [...temp].sort((a, b) =>
      a.orderStatus === "PENDING" && b.orderStatus !== "PENDING" ? -1 : 1
    );
  }, [orders, orderQuery, from, to]);

  // ============ edit basic order fields ============
  const startEdit = (row) => {
    setEditingId(row._id);
    setEditForm({
      shipToLoc: row.shipToLoc,
      pdtQty: row.pdtQty,
      pdtRate: row.pdtRate,
      dateDely: yyyymmddInput(row.dateDely),
      timeSlot: row.timeSlot,
      orderStatus: row.orderStatus,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };
  const onChangeEdit = (field, value) =>
    setEditForm((f) => ({ ...f, [field]: value }));
  const saveEdit = async (id) => {
    try {
      const original = rawById[id];
      if (!original) throw new Error("Original order not found");

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
      setOrders((prev) =>
        mapOrdersToRows(
          prev.map((o) => (o._id === id ? updated : o._raw || o))
        )
      );
      setLastUpdatedOrder(updated);
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to update order");
    }
  };

  // ============ fleet actions ============
  const openFleetModal = (order) => {
    setFleetModalOrder(order._raw || order);
    setFleetModalOpen(true);
  };
  const closeFleetModal = () => setFleetModalOpen(false);

  const handleFleetAllocated = (updatedOrder) => {
    setOrders((prev) =>
      mapOrdersToRows(
        prev.map((o) =>
          String(o._id) === String(updatedOrder._id) ? updatedOrder : o._raw || o
        )
      )
    );
    setLastUpdatedOrder(updatedOrder);
  };

  const releaseFleet = async (row) => {
    try {
      const fId = row.fleetId || getFleetId(row._raw || row);
      if (!fId) {
        alert("Fleet id not found for this order");
        return;
      }
      const res = await api.put(`/fleets/${fId}/release`, {
        orderId: row._id,
      });
      const updatedOrder = res.data?.order || null;
      if (updatedOrder) {
        handleFleetAllocated(updatedOrder);
      } else {
        // client fallback
        setOrders((prev) =>
          prev.map((r) =>
            r._id === row._id
              ? { ...r, fleetId: null, vehicleRegNo: "", driverName: "" }
              : r
          )
        );
      }
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to release fleet");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Truck size={24} /> Fleet Allocation
        </h2>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white"
          title="Refresh"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-96">
          <input
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            placeholder="Search order / customer / vehicle / driver…"
            className="w-full border rounded pl-9 pr-3 py-2 bg-white"
          />
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-2 bg-white"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-2 bg-white"
          />
        </div>
      </div>

      {error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full bg-white shadow rounded">
            <thead className="bg-orange-200/60 text-gray-800">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                <th>OrderNo</th>
                <th>UserName</th>
                <th>Cust Id</th>
                <th>CustName</th>
                <th>ShipToLoc</th>
                <th>Pdt_Code</th>
                <th>Pdt_Name</th>
                <th className="text-right">PdtQty</th>
                <th>UoM</th>
                <th className="text-right">PdtRate</th>
                <th>Date_Dely</th>
                <th>Time Slot</th>
                <th>Fleet (Vehicle)</th>
                <th>Driver</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading && (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!ordersLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
              {!ordersLoading &&
                filtered.map((row) => {
                  const isEditing = editingId === row._id;
                  const vehicleLast4 = row.vehicleRegNo
                    ? row.vehicleRegNo.slice(-4)
                    : "";

                  return (
                    <tr key={row._id} className="hover:bg-gray-50 align-top">
                      <td className="border px-3 py-2 font-mono">
                        {row.orderNo || "—"}
                      </td>
                      <td className="border px-3 py-2">{row.userName || "—"}</td>
                      <td className="border px-3 py-2">{row.custId || "—"}</td>
                      <td className="border px-3 py-2">{row.custName || "—"}</td>
                      <td className="border px-3 py-2">
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 w-56"
                            value={editForm.shipToLoc}
                            onChange={(e) =>
                              onChangeEdit("shipToLoc", e.target.value)
                            }
                          />
                        ) : (
                          row.shipToLoc || "—"
                        )}
                      </td>
                      <td className="border px-3 py-2">{row.pdtCode || "—"}</td>
                      <td className="border px-3 py-2">{row.pdtName || "—"}</td>
                      <td className="border px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtQty}
                            onChange={(e) => onChangeEdit("pdtQty", e.target.value)}
                          />
                        ) : (
                          row.pdtQty
                        )}
                      </td>
                      <td className="border px-3 py-2">{row.uom || "L"}</td>
                      <td className="border px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right"
                            value={editForm.pdtRate}
                            onChange={(e) => onChangeEdit("pdtRate", e.target.value)}
                          />
                        ) : (
                          row.pdtRate
                        )}
                      </td>
                      <td className="border px-3 py-2">{ddmmyyyy(row.dateDely)}</td>
                      <td className="border px-3 py-2">{row.timeSlot || "—"}</td>

                      {/* Fleet (Vehicle) */}
                      <td className="border px-3 py-2">
                        {row.vehicleRegNo ? (
                          <span className="px-2 py-1 rounded bg-green-200 font-mono">
                            {vehicleLast4}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Driver */}
                      <td className="border px-3 py-2">{row.driverName || "—"}</td>

                      {/* Actions */}
                      <td className="border px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openFleetModal(row)}
                            className="inline-flex items-center gap-1 border px-2 py-1 rounded bg-white hover:bg-gray-50"
                            title="Allocate / Change fleet"
                          >
                            <Wrench size={16} />
                            Modify Fleet
                          </button>
                          <button
                            onClick={() => releaseFleet(row)}
                            disabled={!row.fleetId && !row.vehicleRegNo}
                            className={`inline-flex items-center gap-1 border px-2 py-1 rounded ${
                              row.fleetId || row.vehicleRegNo
                                ? "text-red-600 border-red-300 bg-white hover:bg-gray-50"
                                : "text-gray-400 cursor-not-allowed bg-gray-50"
                            }`}
                            title={
                              row.fleetId || row.vehicleRegNo
                                ? "Release fleet"
                                : "No fleet assigned"
                            }
                          >
                            Release
                          </button>

                          {!isEditing ? (
                            <button
                              onClick={() => startEdit(row)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                              title="Edit order fields"
                            >
                              Edit
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => saveEdit(row._id)}
                                className="ml-2 text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-600 hover:text-gray-800"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Debug: last updated order */}
      {lastUpdatedOrder && (
        <div className="mt-6 bg-[#ffecb3] border border-yellow-200 shadow rounded p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {(lastUpdatedOrder.fleet?.vehicle?.vehicleNo ||
                lastUpdatedOrder.vehicleRegNo ||
                "—") + " - Order Summary"}
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

      {/* ===== FLEET PICKER MODAL ===== */}
      <FleetPicker
        open={fleetModalOpen}
        order={fleetModalOrder}
        onClose={closeFleetModal}
        onAllocated={handleFleetAllocated}
      />
    </div>
  );
}

/* ========================= Fleet Picker (inline) ========================= */

function FleetPicker({ open, onClose, order, onAllocated }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    fetchFleets("");
    // eslint-disable-next-line 

  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchFleets(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line 

  }, [q, open]);

  const fetchFleets = async (term) => {
    setLoading(true);
    try {
      const res = await api.get("/fleets", { params: { search: term || "" } });
      setList(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  };

  const doAllocate = async (fleet) => {
    try {
      setBusyId(fleet._id);
      const res = await api.put(`/fleets/${fleet._id}/allocate`, {
        orderId: order?._id,
      });
      const updatedOrder = res.data?.order || res.data;
      onAllocated?.(updatedOrder);
      onClose?.();
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 409
          ? "Fleet already allocated"
          : "Failed to allocate fleet");
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-[min(760px,92vw)] bg-white rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Truck size={18} />
            <h3 className="font-semibold">Allocate Fleet</h3>
          </div>
          <button className="p-1 rounded hover:bg-gray-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {order && (
            <div className="mb-3 text-sm text-gray-600">
              <span className="font-medium">Order:</span>{" "}
              {order.orderNo || order._id} •{" "}
              <span className="font-medium">Customer:</span>{" "}
              {order.customer?.custName || "—"}
            </div>
          )}

          <div className="relative mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search fleet (vehicle no / driver / depot)…"
              className="w-full border rounded pl-9 pr-3 py-2"
            />
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
          </div>

          <div className="max-h-[420px] overflow-auto divide-y">
            {loading && (
              <div className="py-10 text-center text-gray-500">
                Loading fleets…
              </div>
            )}
            {!loading && list.length === 0 && (
              <div className="py-10 text-center text-gray-500">
                No fleets found.
              </div>
            )}

            {!loading &&
              list.map((f) => {
                const v = f.vehicle || {};
                const d = f.driver || {};
                const driverName = d.driverName || d.profile?.empName || "";
                const vehicleNo = v.vehicleNo || v.regNo || v.registrationNo || "";
                const depot = f.depotCd || v.depotCd || "";

                return (
                  <div key={f._id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{vehicleNo || "(no vehicle)"}</div>
                      <div className="text-sm text-gray-600">
                        {driverName ? `Driver: ${driverName}` : "Driver: —"}
                        {depot ? ` • Depot: ${depot}` : ""}
                        {v.calibratedCapacity ? ` • Cap: ${v.calibratedCapacity}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.isAllocated ? (
                        <span className="text-sm px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700">
                          in use
                        </span>
                      ) : (
                        <button
                          onClick={() => doAllocate(f)}
                          disabled={busyId === f._id}
                          className="border px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {busyId === f._id ? "Allocating…" : "Allocate"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
