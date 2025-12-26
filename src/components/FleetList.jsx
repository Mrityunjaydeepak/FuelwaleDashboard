// src/components/FleetList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  Truck,
  RefreshCcw,
  Search,
  ArrowUpDown,
  Download,
  MapPin,
  ShieldCheck,
  CalendarClock,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

const norm = (v) => String(v ?? "").trim().toLowerCase();

const isTruthy = (v) =>
  v === true ||
  String(v).toLowerCase() === "yes" ||
  String(v).toLowerCase() === "true" ||
  String(v) === "1";

const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yyyy = x.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const daysUntil = (d) => {
  if (!d) return Infinity;
  const now = new Date();
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return Infinity;
  return Math.ceil((dt - now) / (1000 * 60 * 60 * 24));
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function getCurrentUserId() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const candidates = [
        u?.userId,
        u?.empCd,
        u?.employee?.empCd,
        u?.employee?.empCode,
        u?.mobileNo,
        u?.email,
        u?.name,
      ].filter(Boolean);
      return String(candidates[0] || "Md100");
    }
  } catch {}
  return "Md100";
}

function getCurrentRoleLabel() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const t = (u?.userType ?? u?.role ?? localStorage.getItem("userType") ?? "a")
        .toString()
        .toLowerCase();
      const map = {
        a: "Admin",
        e: "Executive",
        ac: "Accounts",
        tr: "Trips",
        d: "Driver",
        va: "Fleet Mngr",
        fm: "Fleet Mngr",
        fleet: "Fleet Mngr",
      };
      return map[t] || String(u?.roleName || u?.userType || "Admin");
    }
  } catch {}
  const t = (localStorage.getItem("userType") || "a").toString().toLowerCase();
  const map = { a: "Admin", e: "Executive", ac: "Accounts", tr: "Trips", d: "Driver", va: "Fleet Mngr" };
  return map[t] || "Admin";
}

function getAllocatedOrderIdFromFleet(f) {
  const candidates = [
    f?.currentOrderId,
    f?.allocatedOrderId,
    f?.assignedOrderId,
    f?.allottedOrderId,
    f?.orderId,
    f?.order?._id,
    f?.order,
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string") return c;
    if (typeof c === "object" && c._id) return String(c._id);
  }
  return null;
}

function getFleetIdFromOrder(o) {
  const f = o?.fleet;
  if (!f) return null;
  if (typeof f === "string") return f;
  if (typeof f === "object" && f._id) return String(f._id);
  return null;
}

function getOrderDeliveryDate(o) {
  return o?.deliveryDate || o?.delyDt || o?.delivery_dt || null;
}

function getOrderTimeSlot(o) {
  return o?.deliveryTimeSlot || o?.deliveryTime || o?.delyTime || "—";
}

function getOrderNo(o) {
  const v = o?.orderNo;
  if (typeof v === "string" && v) return v;
  if (typeof v === "number") return String(v);
  return o?._id ? String(o._id).slice(-6) : "—";
}

function orderQty(o) {
  const items = Array.isArray(o?.items) ? o.items : [];
  return items.reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
}

function getSortVal(r, key) {
  const val = r[key];
  if (val == null) return "";
  if (["insuranceExpiryDt", "fitnessExpiryDt", "permitExpiryDt"].includes(key)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof val === "boolean") return val ? 1 : 0;
  return typeof val === "number" ? val : String(val).toLowerCase();
}

function mapFleetBase(f, orderIdByFleetId) {
  const v = f.vehicle || {};
  const d = f.driver || {};
  const driverName = d.driverName || d.profile?.empName || "";

  const allocatedFromFleet = getAllocatedOrderIdFromFleet(f);
  const allocatedFromOrders = orderIdByFleetId?.[String(f._id)] || null;
  const allocatedOrderId = allocatedFromFleet || allocatedFromOrders || null;

  return {
    _id: f._id,
    vehicleId: v._id || null,
    vehicleNo: v.vehicleNo || v.regNo || v.registrationNo || "",
    make: v.make || "",
    model: v.model || "",
    capacityLtrs: v.capacityLtrs ?? v.calibratedCapacity ?? v.capacity ?? null,
    grossWtKgs: v.grossWtKgs ?? v.grossWeightKgs ?? null,
    monthYear: v.monthYear || v.mfgMonthYear || "",
    totaliserMake: v.totaliserMake || v.totalizerMake || "",
    totaliserModel: v.totaliserModel || v.totalizerModel || "",
    gpsYesNo: isTruthy(f.gpsYesNo ?? v.gpsYesNo),
    volSensor: isTruthy(v.volSensor ?? v.hasVolSensor),
    pesoNo: v.pesoNo || v.PESONo || v.pesono || "",
    insuranceExpiryDt: v.insuranceExpiryDt || v.insuranceExpiryDate || null,
    fitnessExpiryDt: v.fitnessExpiryDt || v.fitnessExpiryDate || null,
    permitExpiryDt: v.permitExpiryDt || v.permitExpiryDate || null,
    depotCd: f.depotCd || v.depotCd || "",
    driverId: d._id || null,
    driverName,
    allocatedOrderId,
  };
}

export default function FleetList() {
  const navigate = useNavigate();

  const [fleets, setFleets] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [depotFilter, setDepotFilter] = useState("");
  const [gpsFilter, setGpsFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [sortKey, setSortKey] = useState("vehicleNo");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState("");

  const [openAssignDriver, setOpenAssignDriver] = useState(false);
  const [openAllocateOrder, setOpenAllocateOrder] = useState(false);
  const [allocateFleetRow, setAllocateFleetRow] = useState(null);

  const [toast, setToast] = useState(null);

  const userId = useMemo(getCurrentUserId, []);
  const roleLabel = useMemo(getCurrentRoleLabel, []);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  }, []);
  showToast._t = showToast._t || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fleetRes, ordersRes] = await Promise.all([
        api.get("/fleets"),
        api.get("/orders").catch(() => ({ data: [] })),
      ]);
      setFleets(Array.isArray(fleetRes.data) ? fleetRes.data : []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load fleets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ordersById = useMemo(() => {
    const m = {};
    for (const o of orders || []) m[String(o._id)] = o;
    return m;
  }, [orders]);

  const orderIdByFleetId = useMemo(() => {
    const m = {};
    const today = new Date();
    for (const o of orders || []) {
      const fid = getFleetIdFromOrder(o);
      if (!fid) continue;

      const candidate = m[fid];
      const d = getOrderDeliveryDate(o);
      const isToday = isSameLocalDay(d, today);
      const status = String(o?.orderStatus || "").toUpperCase();

      if (!candidate) {
        m[fid] = o;
        continue;
      }

      const cStatus = String(candidate?.orderStatus || "").toUpperCase();
      const cIsToday = isSameLocalDay(getOrderDeliveryDate(candidate), today);

      const prefer =
        (isToday && !cIsToday) ||
        (status === "PENDING" && cStatus !== "PENDING");

      if (prefer) m[fid] = o;
    }

    const out = {};
    for (const fid of Object.keys(m)) out[fid] = m[fid]?._id ? String(m[fid]._id) : null;
    return out;
  }, [orders]);

  const rows = useMemo(() => {
    return fleets.map((f) => {
      const base = mapFleetBase(f, orderIdByFleetId);
      const o = base.allocatedOrderId ? ordersById[String(base.allocatedOrderId)] : null;
      const orderNo = o ? getOrderNo(o) : "";
      const delyDate = o ? fmtDate(getOrderDeliveryDate(o)) : "";
      const delyTime = o ? getOrderTimeSlot(o) : "";
      const custName = o?.customer?.custName || "";
      const custCd = o?.customer?.custCd || "";
      return {
        ...base,
        orderNo,
        orderDeliveryDate: delyDate,
        orderDeliveryTime: delyTime,
        orderCustomer: [custCd, custName].filter(Boolean).join(" • "),
      };
    });
  }, [fleets, orderIdByFleetId, ordersById]);

  const depots = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.depotCd && s.add(r.depotCd));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = [...rows];

    const s = norm(q);
    if (s) {
      out = out.filter((r) =>
        [
          r.vehicleNo,
          r.make,
          r.model,
          r.depotCd,
          r.pesoNo,
          r.driverName,
          r.orderNo,
          r.orderCustomer,
        ]
          .map(norm)
          .some((t) => t.includes(s))
      );
    }

    if (depotFilter) out = out.filter((r) => r.depotCd === depotFilter);

    if (gpsFilter) {
      const want = gpsFilter === "yes";
      out = out.filter((r) => r.gpsYesNo === want);
    }

    if (expiryFilter) {
      out = out.filter((r) => {
        const ins = daysUntil(r.insuranceExpiryDt);
        const fit = daysUntil(r.fitnessExpiryDt);
        const per = daysUntil(r.permitExpiryDt);
        if (expiryFilter === "expired") return ins < 0 || fit < 0 || per < 0;
        if (expiryFilter === "30")
          return (
            (ins >= 0 && ins <= 30) ||
            (fit >= 0 && fit <= 30) ||
            (per >= 0 && per <= 30)
          );
        return true;
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const va = getSortVal(a, sortKey);
      const vb = getSortVal(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return out;
  }, [rows, q, depotFilter, gpsFilter, expiryFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Vehicle No",
      "Make",
      "Model",
      "CapacityLtrs",
      "GrossWtKgs",
      "MonthYear",
      "TotaliserMake",
      "TotaliserModel",
      "GpsYesNo",
      "VolSensor",
      "PESONo",
      "InsuranceExpiryDt",
      "FitnessExpiryDt",
      "PermitExpiryDt",
      "DepotAllottedCd",
      "DriverAllotted",
      "OrderAllotted",
      "OrderDelyDt",
      "OrderDelyTime",
      "OrderCustomer",
    ];
    const lines = filtered.map((r) =>
      [
        r.vehicleNo,
        r.make,
        r.model,
        r.capacityLtrs,
        r.grossWtKgs,
        r.monthYear,
        r.totaliserMake,
        r.totaliserModel,
        r.gpsYesNo ? "Yes" : "No",
        r.volSensor ? "Yes" : "No",
        r.pesoNo,
        fmtDate(r.insuranceExpiryDt),
        fmtDate(r.fitnessExpiryDt),
        fmtDate(r.permitExpiryDt),
        r.depotCd,
        r.driverName || "",
        r.orderNo || "",
        r.orderDeliveryDate || "",
        r.orderDeliveryTime || "",
        r.orderCustomer || "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fleet.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const assignDriver = async (vehicleId, driverId) => {
    await api.put("/fleets/assign-driver", { vehicleId, driverId });
  };

  const releaseDriver = async (vehicleId) => {
    await api.put("/fleets/release-driver", { vehicleId });
  };

  const openAllocateModal = (fleetRow) => {
    setAllocateFleetRow(fleetRow);
    setOpenAllocateOrder(true);
  };

  const closeAllocateModal = () => {
    setOpenAllocateOrder(false);
    setAllocateFleetRow(null);
  };

  const allocateOrderToFleet = async (fleetId, orderId) => {
    await api.put(`/fleets/${fleetId}/allocate`, { orderId });
  };

  const releaseOrderFromFleet = async (fleetRow) => {
    const orderId = fleetRow?.allocatedOrderId;
    if (!orderId) throw new Error("No order allocated for this fleet.");
    await api.put(`/fleets/${fleetRow._id}/release`, { orderId });
  };

  const handleHome = () => navigate("/dashboard");
  const handleBack = () => navigate(-1);
  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 px-2 py-3 overflow-x-hidden">
      <div className="max-w-[1300px] mx-auto bg-white border border-gray-400 shadow-sm overflow-x-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-400">
          <div className="text-sm">
            <span>Welcome. </span>
            <span className="font-semibold">{userId}!</span>
            <span className="ml-2 font-semibold">{String(roleLabel || "").toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHome}
              className="px-4 py-1.5 rounded-sm border border-gray-600 bg-orange-600 text-white text-sm hover:bg-orange-700"
            >
              Home
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-1.5 rounded-sm border border-gray-600 bg-orange-600 text-white text-sm hover:bg-orange-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-sm border border-gray-600 bg-orange-600 text-white text-sm hover:bg-orange-700"
            >
              Log Out
            </button>
            <div className="ml-2 text-red-600 font-semibold text-sm">{roleLabel}</div>
          </div>
        </div>

        {/* Title row */}
        <div className="px-3 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3">
            <div className="hidden md:block" />
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-wide">FLEET LISTING</div>
              <div className="text-xs text-gray-600 mt-1">Driver assignment and order allocation view</div>
            </div>
            <div className="flex md:justify-end justify-center">
              <div className="flex items-center justify-center w-[180px] h-[58px] border border-gray-300 rounded bg-white">
                <div className="text-2xl font-bold tracking-tight">
                  <span className="text-orange-600">fuel</span>
                  <span className="text-purple-700">wale</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content panel */}
        <div className="border-t border-gray-400 bg-[#c9f3cd] px-3 py-3 overflow-x-hidden">
          {/* Actions + filters */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setOpenAssignDriver(true)}
                className="px-4 py-2 rounded-md bg-[#0d6078] text-white border-2 border-[#084253] hover:bg-[#0f6f8b] inline-flex items-center gap-2"
              >
                <UserPlus size={16} /> Assign Driver
              </button>
              <button
                onClick={exportCsv}
                className="px-4 py-2 rounded-md bg-[#0d6078] text-white border-2 border-[#084253] hover:bg-[#0f6f8b] inline-flex items-center gap-2"
              >
                <Download size={16} /> Export
              </button>
              <button
                onClick={refresh}
                className="px-4 py-2 rounded-md bg-[#0d6078] text-white border-2 border-[#084253] hover:bg-[#0f6f8b] inline-flex items-center gap-2"
              >
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
              <div className="relative w-full sm:w-[520px]">
                <div className="absolute left-0 top-0 bottom-0 w-[110px] bg-yellow-300 border border-gray-400 flex items-center justify-center font-semibold text-sm">
                  Search
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="By vehicle / driver / depot / order / customer…"
                  className="w-full pl-[120px] pr-10 py-2 border border-gray-400 bg-white"
                />
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
              </div>

              <select
                value={depotFilter}
                onChange={(e) => setDepotFilter(e.target.value)}
                className="border border-gray-400 bg-white px-3 py-2"
                title="Depot"
              >
                <option value="">All Depots</option>
                {depots.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={gpsFilter}
                onChange={(e) => setGpsFilter(e.target.value)}
                className="border border-gray-400 bg-white px-3 py-2"
                title="GPS"
              >
                <option value="">GPS Any</option>
                <option value="yes">GPS Yes</option>
                <option value="no">GPS No</option>
              </select>

              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="border border-gray-400 bg-white px-3 py-2"
                title="Expiry"
              >
                <option value="">Expiry Any</option>
                <option value="30">Expiring 30 days</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {error ? (
            <div className="mt-3 bg-red-100 text-red-700 border border-red-200 px-3 py-2">
              {error}
            </div>
          ) : null}

          {/* Listing box */}
          <div className="mt-3 border border-gray-600 bg-[#e6a4dd] overflow-hidden">
            <div className="text-center font-semibold py-1 border-b border-gray-600 bg-[#d78acd]">
              Fleet Listing
            </div>

            <div className="h-[68vh] overflow-y-auto overflow-x-hidden">
              {/* Header row (md+) */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 sticky top-0 z-10 bg-[#d78acd] border-b border-gray-700 text-[12px] font-semibold">
                <HeaderCell className="col-span-2" label="Vehicle" onSort={() => toggleSort("vehicleNo")} />
                <HeaderCell className="col-span-2" label="Specs" onSort={() => toggleSort("capacityLtrs")} />
                <HeaderCell className="col-span-2" label="Sensors" onSort={() => toggleSort("gpsYesNo")} />
                <HeaderCell className="col-span-2" label="Expiry" onSort={() => toggleSort("insuranceExpiryDt")} />
                <HeaderCell className="col-span-1" label="Depot" onSort={() => toggleSort("depotCd")} />
                <HeaderCell className="col-span-1" label="Driver" onSort={() => toggleSort("driverName")} />
                <HeaderCell className="col-span-1" label="Order" onSort={() => toggleSort("orderNo")} />
                <div className="col-span-1 px-2 py-1">Action</div>
              </div>

              {loading ? (
                <div className="px-3 py-10 text-center text-gray-900">Loading…</div>
              ) : null}

              {!loading && filtered.length === 0 ? (
                <div className="px-3 py-10 text-center text-gray-900">No fleets found.</div>
              ) : null}

              {!loading &&
                filtered.map((r) => (
                  <div
                    key={r._id}
                    className="border-t border-gray-700 bg-[#e6a4dd] hover:bg-[#dea0d7] transition-colors"
                  >
                    {/* Desktop grid row */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 text-[13px]">
                      <div className="col-span-2">
                        <div className="font-mono font-semibold break-words">{r.vehicleNo || "—"}</div>
                        <div className="text-[11px] text-gray-900/90 break-words">
                          {[r.make, r.model].filter(Boolean).join(" ") || "—"}
                        </div>
                      </div>

                      <div className="col-span-2 text-[12px] text-gray-900/95">
                        <div>
                          <span className="font-semibold">Cap:</span> {r.capacityLtrs ?? "—"}
                        </div>
                        <div>
                          <span className="font-semibold">GW:</span> {r.grossWtKgs ?? "—"}
                        </div>
                        <div className="break-words">
                          <span className="font-semibold">PESO:</span> <span className="font-mono">{r.pesoNo || "—"}</span>
                        </div>
                        <div className="break-words">
                          <span className="font-semibold">MY:</span> {r.monthYear || "—"}
                        </div>
                      </div>

                      <div className="col-span-2 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">GPS</span> <BoolPill val={r.gpsYesNo} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-semibold">VOL</span> <BoolPill val={r.volSensor} />
                        </div>
                        <div className="mt-1 break-words text-[11px] text-gray-900/90">
                          <span className="font-semibold">Tot:</span>{" "}
                          {[r.totaliserMake, r.totaliserModel].filter(Boolean).join(" / ") || "—"}
                        </div>
                      </div>

                      <div className="col-span-2 text-[12px]">
                        <div className="mb-1">
                          <ExpiryCell label="INS" date={r.insuranceExpiryDt} />
                        </div>
                        <div className="mb-1">
                          <ExpiryCell label="FIT" date={r.fitnessExpiryDt} />
                        </div>
                        <div>
                          <ExpiryCell label="PER" date={r.permitExpiryDt} />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} className="text-gray-900" />
                          <span className="font-semibold break-words">{r.depotCd || "—"}</span>
                        </span>
                      </div>

                      <div className="col-span-1 text-[12px] break-words">
                        <div className="font-semibold">{r.driverName || "—"}</div>
                        <div className="text-[11px] text-gray-900/80">{r.driverId ? "Assigned" : "Not Assigned"}</div>
                      </div>

                      <div className="col-span-1 text-[12px]">
                        <div className="font-mono font-semibold break-words">{r.orderNo || "—"}</div>
                        {r.orderNo ? (
                          <>
                            <div className="text-[11px] break-words">{r.orderCustomer || "—"}</div>
                            <div className="text-[11px] text-gray-900/85">
                              {r.orderDeliveryDate || "—"}{" "}
                              <span className="ml-1">{r.orderDeliveryTime || ""}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-gray-900/85">Not Allocated</div>
                        )}
                      </div>

                      <div className="col-span-1">
                        <div className="grid gap-2">
                          <ActionButton
                            onClick={() => setOpenAssignDriver({ vehiclePrefill: r.vehicleId })}
                            icon={<UserPlus size={16} />}
                            label="Assign"
                          />
                          <ActionButton
                            disabled={!r.driverId}
                            onClick={async () => {
                              try {
                                if (!r.driverId) return;
                                await api.put("/fleets/release-driver", { vehicleId: r.vehicleId });
                                await refresh();
                                showToast("success", "Driver removed from fleet.");
                              } catch (e) {
                                showToast("error", e?.response?.data?.error || "Failed to remove driver");
                              }
                            }}
                            icon={<UserX size={16} />}
                            label="Remove"
                            danger
                          />
                          <ActionButton
                            onClick={() => openAllocateModal(r)}
                            icon={<Truck size={16} />}
                            label="Allocate"
                          />
                          <ActionButton
                            disabled={!r.allocatedOrderId}
                            onClick={async () => {
                              try {
                                if (!r.allocatedOrderId) return;
                                await releaseOrderFromFleet(r);
                                await refresh();
                                showToast("success", "Order released from fleet.");
                              } catch (e) {
                                showToast("error", e?.response?.data?.error || e?.message || "Failed to release order");
                              }
                            }}
                            icon={<X size={16} />}
                            label="Release"
                            danger
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mobile card row */}
                    <div className="md:hidden p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-semibold break-words">{r.vehicleNo || "—"}</div>
                          <div className="text-xs text-gray-900/90 break-words">
                            {[r.make, r.model].filter(Boolean).join(" ") || "—"}
                          </div>
                          <div className="text-xs mt-1">
                            <span className="font-semibold">Depot:</span> {r.depotCd || "—"}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-semibold">Cap: {r.capacityLtrs ?? "—"}</div>
                          <div>GW: {r.grossWtKgs ?? "—"}</div>
                          <div className="font-mono">PESO: {r.pesoNo || "—"}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/50 border border-gray-600 rounded p-2">
                          <div className="font-semibold mb-1">Sensors</div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">GPS</span> <BoolPill val={r.gpsYesNo} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-semibold">VOL</span> <BoolPill val={r.volSensor} />
                          </div>
                        </div>

                        <div className="bg-white/50 border border-gray-600 rounded p-2">
                          <div className="font-semibold mb-1">Expiry</div>
                          <div className="space-y-1">
                            <ExpiryCell label="INS" date={r.insuranceExpiryDt} />
                            <ExpiryCell label="FIT" date={r.fitnessExpiryDt} />
                            <ExpiryCell label="PER" date={r.permitExpiryDt} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 bg-white/50 border border-gray-600 rounded p-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-semibold">Driver</div>
                            <div className="break-words">{r.driverName || "—"}</div>
                            <div className="text-[11px] text-gray-900/80">{r.driverId ? "Assigned" : "Not Assigned"}</div>
                          </div>
                          <div>
                            <div className="font-semibold">Order</div>
                            <div className="font-mono font-semibold break-words">{r.orderNo || "—"}</div>
                            {r.orderNo ? (
                              <>
                                <div className="break-words">{r.orderCustomer || "—"}</div>
                                <div className="text-[11px] text-gray-900/85">
                                  {r.orderDeliveryDate || "—"}{" "}
                                  <span className="ml-1">{r.orderDeliveryTime || ""}</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-[11px] text-gray-900/85">Not Allocated</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <ActionButton
                          onClick={() => setOpenAssignDriver({ vehiclePrefill: r.vehicleId })}
                          icon={<UserPlus size={16} />}
                          label="Assign"
                        />
                        <ActionButton
                          disabled={!r.driverId}
                          onClick={async () => {
                            try {
                              if (!r.driverId) return;
                              await api.put("/fleets/release-driver", { vehicleId: r.vehicleId });
                              await refresh();
                              showToast("success", "Driver removed from fleet.");
                            } catch (e) {
                              showToast("error", e?.response?.data?.error || "Failed to remove driver");
                            }
                          }}
                          icon={<UserX size={16} />}
                          label="Remove"
                          danger
                        />
                        <ActionButton
                          onClick={() => openAllocateModal(r)}
                          icon={<Truck size={16} />}
                          label="Allocate"
                        />
                        <ActionButton
                          disabled={!r.allocatedOrderId}
                          onClick={async () => {
                            try {
                              if (!r.allocatedOrderId) return;
                              await releaseOrderFromFleet(r);
                              await refresh();
                              showToast("success", "Order released from fleet.");
                            } catch (e) {
                              showToast("error", e?.response?.data?.error || e?.message || "Failed to release order");
                            }
                          }}
                          icon={<X size={16} />}
                          label="Release"
                          danger
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {toast && (
          <div
            className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 shadow-lg text-sm ${
              toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {openAssignDriver ? (
          <AssignDriverModal
            onClose={() => setOpenAssignDriver(false)}
            onSubmit={async (vehicleId, driverId) => {
              try {
                await assignDriver(vehicleId, driverId);
                await refresh();
                showToast("success", "Driver assigned to vehicle.");
              } catch (e) {
                showToast("error", e?.response?.data?.error || "Failed to assign driver");
                throw e;
              }
            }}
            vehiclePrefill={typeof openAssignDriver === "object" ? openAssignDriver.vehiclePrefill : undefined}
          />
        ) : null}

        {openAllocateOrder ? (
          <AllocateOrderModal
            onClose={() => {
              closeAllocateModal();
            }}
            fleetRow={allocateFleetRow}
            orders={orders}
            onAllocate={async (fleetId, orderId) => {
              await allocateOrderToFleet(fleetId, orderId);
              await refresh();
              showToast("success", "Order allocated to fleet.");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function HeaderCell({ label, onSort, className = "" }) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={`${className} text-left px-2 py-1 inline-flex items-center gap-1 select-none`}
      title={`Sort by ${label}`}
    >
      {label} <ArrowUpDown size={14} />
    </button>
  );
}

function ActionButton({ onClick, icon, label, disabled, danger }) {
  const base =
    "w-full px-2 py-1.5 rounded border inline-flex items-center justify-center gap-1 text-[12px]";
  const cls = disabled
    ? `${base} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed`
    : danger
    ? `${base} bg-white border-red-400 text-red-700 hover:bg-gray-50`
    : `${base} bg-white border-gray-700 text-gray-900 hover:bg-gray-50`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {icon} {label}
    </button>
  );
}

function BoolPill({ val }) {
  const yes = isTruthy(val);
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] border ${
        yes ? "bg-green-100 text-green-800 border-green-300" : "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {yes ? "Yes" : "No"}
    </span>
  );
}

function ExpiryCell({ label, date }) {
  const n = daysUntil(date);
  const txt = fmtDate(date);

  let cls = "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ";
  let icon = <CalendarClock size={13} />;

  if (!date || !Number.isFinite(n)) {
    cls += "bg-gray-100 text-gray-700 border-gray-300";
  } else if (n < 0) {
    cls += "bg-red-100 text-red-800 border-red-300";
    icon = <ShieldCheck size={13} />;
  } else if (n <= 30) {
    cls += "bg-amber-100 text-amber-900 border-amber-300";
  } else {
    cls += "bg-green-100 text-green-800 border-green-300";
  }

  const title = !date || !Number.isFinite(n) ? "—" : n < 0 ? "Expired" : `${n} days left`;

  return (
    <span className={cls} title={title}>
      <span className="font-semibold">{label}</span> {icon} {txt}
    </span>
  );
}

/* ---------- Modals ---------- */

function AssignDriverModal({ onClose, onSubmit, vehiclePrefill }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState(vehiclePrefill ?? "");
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState("");
  const [qVeh, setQVeh] = useState("");
  const [qDrv, setQDrv] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [vRes, dRes] = await Promise.all([api.get("/vehicles"), api.get("/drivers")]);
        if (!mounted) return;
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
        setDrivers(Array.isArray(dRes.data) ? dRes.data : []);
      } catch (e) {
        setError(e?.response?.data?.error || "Failed to load vehicles/drivers");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredVehicles = useMemo(() => {
    const s = norm(qVeh);
    return vehicles
      .map((v) => ({
        id: v._id,
        label: v.vehicleNo || v.regNo || v.registrationNo || "(unnamed vehicle)",
        depot: v.depotCd || "",
      }))
      .filter((v) => (s ? norm(v.label + " " + v.depot).includes(s) : true));
  }, [vehicles, qVeh]);

  const filteredDrivers = useMemo(() => {
    const s = norm(qDrv);
    return drivers
      .map((d) => ({
        id: d._id,
        label: d.driverName || d.profile?.empName || "(unnamed driver)",
        code: d.empCode || d.code || "",
      }))
      .filter((d) => (s ? norm(d.label + " " + d.code).includes(s) : true));
  }, [drivers, qDrv]);

  const canSubmit = vehicleId && driverId && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit(vehicleId, driverId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-xl bg-white shadow-xl border border-gray-400">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-400 bg-[#c9f3cd]">
          <div className="font-semibold inline-flex items-center gap-2">
            <UserPlus size={18} /> Assign Driver to Vehicle
          </div>
          <button className="p-1 rounded hover:bg-white/70" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 grid gap-4">
          {error && <div className="bg-red-100 text-red-700 border border-red-200 p-2 text-sm">{error}</div>}

          <div className="grid gap-2">
            <label className="text-sm font-semibold">Vehicle</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={qVeh}
                onChange={(e) => setQVeh(e.target.value)}
                placeholder="Search vehicles…"
                className="border border-gray-400 px-2 py-2 bg-white"
              />
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="border border-gray-400 px-2 py-2 bg-white"
                required
              >
                <option value="" disabled>
                  Select vehicle
                </option>
                {filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} {v.depot ? `· ${v.depot}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold">Driver</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={qDrv}
                onChange={(e) => setQDrv(e.target.value)}
                placeholder="Search drivers…"
                className="border border-gray-400 px-2 py-2 bg-white"
              />
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="border border-gray-400 px-2 py-2 bg-white"
                required
              >
                <option value="" disabled>
                  Select driver
                </option>
                {filteredDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} {d.code ? `· ${d.code}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="border border-gray-500 px-4 py-2 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-4 py-2 text-white font-semibold ${
                canSubmit ? "bg-orange-600 hover:bg-orange-700" : "bg-orange-300 cursor-not-allowed"
              }`}
            >
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocateOrderModal({ onClose, fleetRow, orders, onAllocate }) {
  const [q, setQ] = useState("");
  const [todayOnly, setTodayOnly] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [busy, setBusy] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  const candidates = useMemo(() => {
    const s = norm(q);

    const base = (orders || []).filter((o) => {
      const d = getOrderDeliveryDate(o);
      if (todayOnly) return isSameLocalDay(d, today);
      return true;
    });

    const searched = s
      ? base.filter((o) => {
          const orderNo = getOrderNo(o);
          const custCd = o?.customer?.custCd || "";
          const custName = o?.customer?.custName || "";
          const shipTo = o?.shipToAddress || "";
          return [orderNo, custCd, custName, shipTo].map(norm).some((t) => t.includes(s));
        })
      : base;

    return searched
      .map((o) => ({
        _id: o._id,
        orderNo: getOrderNo(o),
        customer: [o?.customer?.custCd, o?.customer?.custName].filter(Boolean).join(" • ") || "—",
        qty: orderQty(o),
        delyDate: getOrderDeliveryDate(o),
        timeSlot: getOrderTimeSlot(o),
        status: String(o?.orderStatus || "—"),
      }))
      .sort((a, b) => {
        const da = new Date(a.delyDate || 0).getTime() || 0;
        const db = new Date(b.delyDate || 0).getTime() || 0;
        return da - db;
      });
  }, [orders, q, todayOnly, today]);

  const fleetTitle = useMemo(() => {
    const v = fleetRow?.vehicleNo || "—";
    const d = fleetRow?.driverName || "—";
    const depot = fleetRow?.depotCd || "—";
    return `${v} • Driver: ${d} • Depot: ${depot}`;
  }, [fleetRow]);

  const handleAllocate = async () => {
    if (!fleetRow?._id) return;
    if (!selectedOrderId) return;
    setBusy(true);
    try {
      await onAllocate(fleetRow._id, selectedOrderId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-5xl bg-white shadow-xl border border-gray-400">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-400 bg-[#c9f3cd]">
          <div className="font-semibold inline-flex items-center gap-2">
            <Truck size={18} /> Allocate Order to Fleet
          </div>
          <button className="p-1 rounded hover:bg-white/70" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 grid gap-3">
          <div className="text-sm">
            <div className="font-semibold">Fleet</div>
            <div className="text-gray-700 break-words">{fleetTitle}</div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="relative w-full md:w-[560px]">
              <div className="absolute left-0 top-0 bottom-0 w-[120px] bg-yellow-300 border border-gray-400 flex items-center justify-center font-semibold text-sm">
                Search
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="By order / customer / ship-to…"
                className="w-full pl-[130px] pr-10 py-2 border border-gray-400 bg-white"
              />
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />
              Today only
            </label>
          </div>

          <div className="border border-gray-600 bg-[#e6a4dd] overflow-hidden">
            <div className="text-center font-semibold py-1 border-b border-gray-600 bg-[#d78acd]">
              Orders
            </div>

            <div className="h-[52vh] overflow-y-auto overflow-x-hidden">
              <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 sticky top-0 z-10 bg-[#d78acd] border-b border-gray-700 text-[12px] font-semibold">
                <div className="col-span-1 px-2">Select</div>
                <div className="col-span-2 px-2">Order</div>
                <div className="col-span-5 px-2">Customer</div>
                <div className="col-span-1 px-2 text-right">Qty</div>
                <div className="col-span-2 px-2">Delivery</div>
                <div className="col-span-1 px-2">Status</div>
              </div>

              {candidates.length === 0 ? (
                <div className="px-3 py-10 text-center text-gray-900">No orders found.</div>
              ) : null}

              {candidates.map((o) => (
                <div key={o._id} className="border-t border-gray-700 bg-[#e6a4dd] hover:bg-[#dea0d7] transition-colors">
                  <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 text-[13px]">
                    <div className="col-span-1 px-2">
                      <input
                        type="radio"
                        name="allocOrder"
                        value={o._id}
                        checked={String(selectedOrderId) === String(o._id)}
                        onChange={() => setSelectedOrderId(o._id)}
                      />
                    </div>
                    <div className="col-span-2 px-2 font-mono font-semibold break-words">{o.orderNo}</div>
                    <div className="col-span-5 px-2 break-words">{o.customer}</div>
                    <div className="col-span-1 px-2 text-right">{o.qty}</div>
                    <div className="col-span-2 px-2 text-[12px]">
                      <div className="font-semibold">{fmtDate(o.delyDate)}</div>
                      <div className="text-gray-900/85">{o.timeSlot}</div>
                    </div>
                    <div className="col-span-1 px-2 break-words">{o.status}</div>
                  </div>

                  <div className="md:hidden p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="allocOrderMobile"
                        value={o._id}
                        checked={String(selectedOrderId) === String(o._id)}
                        onChange={() => setSelectedOrderId(o._id)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="font-mono font-semibold break-words">{o.orderNo}</div>
                        <div className="text-xs break-words">{o.customer}</div>
                        <div className="text-xs mt-1">
                          <span className="font-semibold">Qty:</span> {o.qty}{" "}
                          <span className="ml-3 font-semibold">Delivery:</span> {fmtDate(o.delyDate)}{" "}
                          <span className="ml-1">{o.timeSlot}</span>
                        </div>
                        <div className="text-xs mt-0.5">
                          <span className="font-semibold">Status:</span> {o.status}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-500 px-4 py-2 bg-white hover:bg-gray-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!fleetRow?._id || !selectedOrderId) return;
                setBusy(true);
                try {
                  await onAllocate(fleetRow._id, selectedOrderId);
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || !selectedOrderId}
              className={`px-4 py-2 text-white font-semibold ${
                busy || !selectedOrderId ? "bg-orange-300 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {busy ? "Allocating…" : "Allocate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
