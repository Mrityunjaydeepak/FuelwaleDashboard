import React, { useEffect, useMemo, useState } from "react";
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
  Plus,
  X,
} from "lucide-react";

/**
 * Fleet item shape returned by backend:
 *  {
 *    _id,           // fleet id
 *    vehicle: { ...Vehicle fields... },
 *    driver: { _id, driverName, profile.empName } | null,
 *    depotCd, gpsYesNo, assignedAt, assignedBy
 *  }
 */

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
  const diff = Math.ceil((dt - now) / (1000 * 60 * 60 * 24));
  return diff;
};

export default function FleetList() {
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [depotFilter, setDepotFilter] = useState("");
  const [gpsFilter, setGpsFilter] = useState(""); // "", "yes", "no"
  const [expiryFilter, setExpiryFilter] = useState(""); // "", "30", "expired"
  const [sortKey, setSortKey] = useState("vehicleNo");
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"
  const [error, setError] = useState("");

  // add-fleet modal state (boolean | { vehiclePrefill: string })
  const [openAdd, setOpenAdd] = useState(false);

  // toast state
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg: string }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line 
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/fleets");
      setFleets(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load fleets.");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => fleets.map(mapFleet), [fleets]);

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
        [r.vehicleNo, r.make, r.model, r.depotCd, r.pesoNo, r.driverName]
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
      "Totaliser make",
      "Totaliser Model",
      "GpsYesNo",
      "VolSensor",
      "PESONo",
      "InsuranceExpiryDt",
      "FitnessExpiryDt",
      "PermitExpiryDt",
      "DepotAllottedCd",
      "DriverAllotted",
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

  // inline assign/unassign actions that hit Fleet controller
  const assignDriver = async (vehicleId, driverId) => {
    try {
      await api.put("/fleets/assign-driver", { vehicleId, driverId });
      await refresh();
      showToast("success", "Driver assigned to vehicle.");
    } catch (e) {
      showToast("error", e?.response?.data?.error || "Failed to assign driver");
    }
  };
  const releaseDriver = async (vehicleId) => {
    try {
      await api.put("/fleets/release-driver", { vehicleId });
      await refresh();
      showToast("success", "Driver removed from fleet.");
    } catch (e) {
      showToast("error", e?.response?.data?.error || "Failed to remove driver");
    }
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* sticky header / toolbar container to prevent overflow */}
      <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-2xl px-4 py-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Truck size={22} /> Fleet Listing
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenAdd(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                title="Add Fleet"
              >
                <Plus size={16} /> Add Fleet
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
                title="Export CSV"
              >
                <Download size={16} /> Export
              </button>
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 border px-3 py-2 rounded bg-white hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search vehicle / make / model / driver / depot…"
                className="w-full border rounded pl-9 pr-3 py-2 bg-white"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={depotFilter}
                onChange={(e) => setDepotFilter(e.target.value)}
                className="border rounded px-2 py-2 bg-white w-full"
                title="Filter by depot"
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
                className="border rounded px-2 py-2 bg-white w-full"
                title="Filter by GPS"
              >
                <option value="">GPS: Any</option>
                <option value="yes">GPS: Yes</option>
                <option value="no">GPS: No</option>
              </select>
            </div>
            <div>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="border rounded px-2 py-2 bg-white w-full"
                title="Expiry attention"
              >
                <option value="">Expiry: Any</option>
                <option value="30">Expiring in 30 days</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
     <div className="mx-auto max-w-screen-2xl px-4 py-4">
  {error ? (
    <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  ) : (
    <div className="relative">
      {/* Tall, scrollable table area */}
      <div className="rounded border bg-white shadow-sm h-[70vh] overflow-auto">
        <table className="min-w-[1000px] w-full">
          {/* Header sticks to the top of THIS scroll box */}
          <thead className="bg-yellow-300 text-gray-900 sticky top-0 z-10">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
              <Th label="Vehicle No" onSort={() => toggleSort("vehicleNo")} />
              <Th label="Make" onSort={() => toggleSort("make")} />
              <Th label="Model" onSort={() => toggleSort("model")} />
              <Th label="CapacityLtrs" onSort={() => toggleSort("capacityLtrs")} />
              <Th label="GrossWtKgs" onSort={() => toggleSort("grossWtKgs")} />
              <Th label="MonthYear" onSort={() => toggleSort("monthYear")} />
              <Th label="Totaliser make" onSort={() => toggleSort("totaliserMake")} />
              <Th label="Totaliser Model" onSort={() => toggleSort("totaliserModel")} />
              <Th label="GpsYesNo" onSort={() => toggleSort("gpsYesNo")} />
              <Th label="VolSensor" onSort={() => toggleSort("volSensor")} />
              <Th label="PESONo" onSort={() => toggleSort("pesoNo")} />
              <Th label="InsuranceExpiryDt" onSort={() => toggleSort("insuranceExpiryDt")} />
              <Th label="FitnessExpiryDt" onSort={() => toggleSort("fitnessExpiryDt")} />
              <Th label="PermitExpiryDt" onSort={() => toggleSort("permitExpiryDt")} />
              <Th label="DepotAllottedCd" onSort={() => toggleSort("depotCd")} />
              <Th label="DriverAllotted" onSort={() => toggleSort("driverName")} />
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={17} className="px-3 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={17} className="px-3 py-10 text-center text-gray-500">
                  No fleets found.
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="border-t px-3 py-2 font-mono">{r.vehicleNo || "—"}</td>
                  <td className="border-t px-3 py-2">{r.make || "—"}</td>
                  <td className="border-t px-3 py-2">{r.model || "—"}</td>
                  <td className="border-t px-3 py-2">{r.capacityLtrs ?? "—"}</td>
                  <td className="border-t px-3 py-2">{r.grossWtKgs ?? "—"}</td>
                  <td className="border-t px-3 py-2">{r.monthYear || "—"}</td>
                  <td className="border-t px-3 py-2">{r.totaliserMake || "—"}</td>
                  <td className="border-t px-3 py-2">{r.totaliserModel || "—"}</td>
                  <td className="border-t px-3 py-2">
                    <BoolPill val={r.gpsYesNo} />
                  </td>
                  <td className="border-t px-3 py-2">
                    <BoolPill val={r.volSensor} />
                  </td>
                  <td className="border-t px-3 py-2">{r.pesoNo || "—"}</td>

                  <td className="border-t px-3 py-2">
                    <ExpiryCell date={r.insuranceExpiryDt} />
                  </td>
                  <td className="border-t px-3 py-2">
                    <ExpiryCell date={r.fitnessExpiryDt} />
                  </td>
                  <td className="border-t px-3 py-2">
                    <ExpiryCell date={r.permitExpiryDt} />
                  </td>

                  <td className="border-t px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} className="text-gray-500" />
                      {r.depotCd || "—"}
                    </span>
                  </td>
                  <td className="border-t px-3 py-2">{r.driverName || "—"}</td>

                  <td className="border-t px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setOpenAdd({ vehiclePrefill: r.vehicleId })}
                        className="inline-flex items-center gap-1 border px-2 py-1 rounded bg-white hover:bg-gray-50 text-blue-700"
                        title="Assign / Change driver"
                      >
                        <UserPlus size={16} />
                        Assign
                      </button>
                      <button
                        onClick={() => releaseDriver(r.vehicleId)}
                        disabled={!r.driverId}
                        className={`inline-flex items-center gap-1 border px-2 py-1 rounded ${
                          r.driverId
                            ? "text-red-600 border-red-300 bg-white hover:bg-gray-50"
                            : "text-gray-400 cursor-not-allowed bg-gray-50"
                        }`}
                        title={r.driverId ? "Remove driver" : "No driver assigned"}
                      >
                        <UserX size={16} />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )}
</div>


      {/* Add Fleet Modal */}
      {openAdd ? (
        <AddFleetModal
          onClose={() => setOpenAdd(false)}
          onSubmit={(vehicleId, driverId) => assignDriver(vehicleId, driverId)}
          vehiclePrefill={typeof openAdd === "object" ? openAdd.vehiclePrefill : undefined}
        />
      ) : null}

      {/* toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 shadow-lg text-sm ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Th({ label, onSort }) {
  return (
    <th
      className="select-none cursor-pointer sticky -top-px bg-yellow-300/95"
      onClick={onSort}
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1">
        {label} <ArrowUpDown size={14} />
      </span>
    </th>
  );
}

function BoolPill({ val }) {
  const yes = isTruthy(val);
  return (
    <span
      className={`px-2 py-0.5 rounded text-sm ${
        yes
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-gray-100 text-gray-600 border border-gray-200"
      }`}
    >
      {yes ? "Yes" : "No"}
    </span>
  );
}

function ExpiryCell({ date }) {
  const n = daysUntil(date);
  const txt = fmtDate(date);
  let cls =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm border ";
  let icon = <CalendarClock size={14} />;
  if (!date || !Number.isFinite(n)) {
    cls += "bg-gray-100 text-gray-600 border-gray-200";
  } else if (n < 0) {
    cls += "bg-red-100 text-red-700 border-red-200";
    icon = <ShieldCheck size={14} />;
  } else if (n <= 30) {
    cls += "bg-amber-100 text-amber-800 border-amber-200";
  } else {
    cls += "bg-green-100 text-green-700 border-green-200";
  }
  return (
    <span className={cls} title={`${n < 0 ? "Expired" : `${n} days left`}`}>
      {icon} {txt}
    </span>
  );
}

function getSortVal(r, key) {
  const val = r[key];
  if (val == null) return "";
  if (["insuranceExpiryDt", "fitnessExpiryDt", "permitExpiryDt"].includes(key)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof val === "boolean") return val ? 1 : 0;
  return typeof val === "number" ? val : String(val).toLowerCase();
}

function mapFleet(f) {
  const v = f.vehicle || {};
  const d = f.driver || {};

  const driverName = d.driverName || d.profile?.empName || "";

  return {
    _id: f._id,

    // vehicle identity
    vehicleId: v._id || null,
    vehicleNo: v.vehicleNo || v.regNo || v.registrationNo || "",

    // specs
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

    // expiry
    insuranceExpiryDt: v.insuranceExpiryDt || v.insuranceExpiryDate || null,
    fitnessExpiryDt: v.fitnessExpiryDt || v.fitnessExpiryDate || null,
    permitExpiryDt: v.permitExpiryDt || v.permitExpiryDate || null,

    // depot / driver
    depotCd: f.depotCd || v.depotCd || "",
    driverId: d._id || null,
    driverName,
  };
}

/* -------------- Add Fleet Modal -------------- */

function AddFleetModal({ onClose, onSubmit, vehiclePrefill }) {
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
        // Feel free to replace these endpoints with your own.
        const [vRes, dRes] = await Promise.all([
          api.get("/vehicles"),
          api.get("/drivers"),
        ]);
        if (!mounted) return;
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
        setDrivers(Array.isArray(dRes.data) ? dRes.data : []);
      } catch (e) {
        setError(e?.response?.data?.error || "Failed to load vehicles/drivers");
      } finally {
        mounted && setLoading(false);
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
    try {
      await onSubmit(vehicleId, driverId);
      onClose();
    } catch {
      // parent handles toast; keep modal open if needed
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* modal card */}
      <div className="relative z-50 w-full max-w-xl mx-4 rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus size={18} /> Add Fleet
          </h3>
          <button
            className="p-1 rounded hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 grid gap-4">
          {error && (
            <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{error}</div>
          )}

          {/* Vehicle */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Vehicle</label>
            <div className="flex gap-2">
              <input
                value={qVeh}
                onChange={(e) => setQVeh(e.target.value)}
                placeholder="Search vehicles…"
                className="w-1/2 border rounded px-2 py-2 bg-white"
              />
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-1/2 border rounded px-2 py-2 bg-white"
                required
              >
                <option value="" disabled>
                  Select a vehicle
                </option>
                {filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} {v.depot ? `· ${v.depot}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Driver */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Driver</label>
            <div className="flex gap-2">
              <input
                value={qDrv}
                onChange={(e) => setQDrv(e.target.value)}
                placeholder="Search drivers…"
                className="w-1/2 border rounded px-2 py-2 bg-white"
              />
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-1/2 border rounded px-2 py-2 bg-white"
                required
              >
                <option value="" disabled>
                  Select a driver
                </option>
                {filteredDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} {d.code ? `· ${d.code}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-3 py-2 rounded text-white ${
                canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
              }`}
            >
              Assign Driver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
