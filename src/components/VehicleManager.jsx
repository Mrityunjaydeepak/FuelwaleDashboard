import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  TruckIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  SaveIcon,
  XIcon
} from 'lucide-react';

export default function VehicleManagement() {
  const initialForm = {
    // required
    vehicleNo: '',
    depotCd: '',

    // specs
    make: '',
    model: '',
    capacityLtrs: '',
    calibratedCapacity: '',
    grossWtKgs: '',

    monthYear: '',
    totaliserMake: '',
    totaliserModel: '',

    // sensors
    gpsYesNo: false,
    volSensor: false,
    dipStickYesNo: false,
    loadSensorYesNo: false,

    // compliance / misc
    pesoNo: '',
    insuranceExpiryDt: '',
    fitnessExpiryDt: '',
    permitExpiryDt: '',

    // relation
    route: ''
  };

  const [form, setForm]               = useState(initialForm);
  const [depots, setDepots]           = useState([]);
  const [routes, setRoutes]           = useState([]);
  const [vehicles, setVehicles]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState(initialForm);
  const [editLoading, setEditLoading] = useState(false);

  // utils
  const numOrUndefined = (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const toDateInput = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '–');

  // Load depots, routes & existing vehicles
  useEffect(() => {
    api.get('/depots').then(r => setDepots(r.data));
    api.get('/routes').then(r => setRoutes(r.data));
    api.get('/vehicles').then(r => setVehicles(r.data));
  }, []);

  // Generic change handler (text, number, checkbox, select, date)
  const handleChange = e => {
    const { name, type, value, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/vehicles', {
        // primary identifiers
        vehicleNo:     form.vehicleNo,
        licensePlate:  form.vehicleNo, // 🔧 legacy unique index safety

        // depot & relations
        depotCd:       form.depotCd,
        route:         form.route || undefined,

        // specs
        make:               form.make,
        model:              form.model,
        capacityLtrs:       numOrUndefined(form.capacityLtrs),
        calibratedCapacity: numOrUndefined(form.calibratedCapacity),
        grossWtKgs:         numOrUndefined(form.grossWtKgs),

        monthYear:      form.monthYear || undefined,
        totaliserMake:  form.totaliserMake,
        totaliserModel: form.totaliserModel,

        // sensors
        gpsYesNo:        form.gpsYesNo,
        volSensor:       form.volSensor,
        dipStickYesNo:   form.dipStickYesNo,
        loadSensorYesNo: form.loadSensorYesNo,

        // compliance / misc
        pesoNo:            form.pesoNo,
        insuranceExpiryDt: form.insuranceExpiryDt || undefined,
        fitnessExpiryDt:   form.fitnessExpiryDt || undefined,
        permitExpiryDt:    form.permitExpiryDt || undefined
      });
      const res = await api.get('/vehicles');
      setVehicles(res.data);
      setForm(initialForm);
    } catch (err) {
      console.error('Vehicle create error', err.response || err);
      setError(err.response?.data?.error || 'Failed to create vehicle');
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const handleDelete = async id => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      setVehicles(vs => vs.filter(v => v._id !== id));
    } catch (err) {
      console.error('Delete error', err);
      alert('Failed to delete vehicle');
    }
  };

  // Edit
  const startEdit = v => {
    setEditingId(v._id);
    setEditForm({
      vehicleNo:          v.vehicleNo,
      depotCd:            v.depotCd,

      make:               v.make || '',
      model:              v.model || '',
      capacityLtrs:       (v.capacityLtrs ?? '').toString(),
      calibratedCapacity: (v.calibratedCapacity ?? '').toString(),
      grossWtKgs:         (v.grossWtKgs ?? '').toString(),

      monthYear:          v.monthYear || '',
      totaliserMake:      v.totaliserMake || '',
      totaliserModel:     v.totaliserModel || '',

      gpsYesNo:           Boolean(v.gpsYesNo),
      volSensor:          Boolean(v.volSensor),
      dipStickYesNo:      Boolean(v.dipStickYesNo),
      loadSensorYesNo:    Boolean(v.loadSensorYesNo),

      pesoNo:             v.pesoNo || '',

      insuranceExpiryDt:  toDateInput(v.insuranceExpiryDt),
      fitnessExpiryDt:    toDateInput(v.fitnessExpiryDt),
      permitExpiryDt:     toDateInput(v.permitExpiryDt),

      route:              v.route?._id || ''
    });
    setError('');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };
  const handleEditChange = e => {
    const { name, type, value, checked } = e.target;
    setEditForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };
  const submitEdit = async e => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.put(`/vehicles/${editingId}`, {
        // primary identifiers
        vehicleNo:     editForm.vehicleNo,
        licensePlate:  editForm.vehicleNo, // 🔧 legacy unique index safety

        // depot & relations
        depotCd:       editForm.depotCd,
        route:         editForm.route || undefined,

        // specs
        make:               editForm.make,
        model:              editForm.model,
        capacityLtrs:       numOrUndefined(editForm.capacityLtrs),
        calibratedCapacity: numOrUndefined(editForm.calibratedCapacity),
        grossWtKgs:         numOrUndefined(editForm.grossWtKgs),

        monthYear:      editForm.monthYear || undefined,
        totaliserMake:  editForm.totaliserMake,
        totaliserModel: editForm.totaliserModel,

        // sensors
        gpsYesNo:        editForm.gpsYesNo,
        volSensor:       editForm.volSensor,
        dipStickYesNo:   editForm.dipStickYesNo,
        loadSensorYesNo: editForm.loadSensorYesNo,

        // compliance / misc
        pesoNo:            editForm.pesoNo,
        insuranceExpiryDt: editForm.insuranceExpiryDt || undefined,
        fitnessExpiryDt:   editForm.fitnessExpiryDt || undefined,
        permitExpiryDt:    editForm.permitExpiryDt || undefined
      });
      setVehicles(vs => vs.map(v => (v._id === editingId ? res.data : v)));
      setEditingId(null);
    } catch (err) {
      console.error('Edit error', err.response || err);
      setError(err.response?.data?.error || 'Failed to update vehicle');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <TruckIcon size={24}/> Vehicle Management
        </h2>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle No */}
            <div>
              <label className="block mb-1 font-semibold">Vehicle No</label>
              <input
                name="vehicleNo"
                value={form.vehicleNo}
                onChange={handleChange}
                required
                maxLength={10}
                placeholder="MH01AB9999"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            {/* Depot */}
            <div>
              <label className="block mb-1 font-semibold">Depot</label>
              <select
                name="depotCd"
                value={form.depotCd}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="">Select Depot</option>
                {depots.map(d => (
                  <option key={d._id} value={d.depotCd}>
                    {d.depotCd} — {d.depotName}
                  </option>
                ))}
              </select>
            </div>

            {/* Make */}
            <div>
              <label className="block mb-1 font-semibold">Make</label>
              <input
                name="make"
                value={form.make}
                onChange={handleChange}
                placeholder="Volvo"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            {/* Model */}
            <div>
              <label className="block mb-1 font-semibold">Model</label>
              <input
                name="model"
                value={form.model}
                onChange={handleChange}
                placeholder="FH16"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* Capacity (L) */}
            <div>
              <label className="block mb-1 font-semibold">Capacity (L)</label>
              <input
                name="capacityLtrs"
                type="number"
                value={form.capacityLtrs}
                onChange={handleChange}
                placeholder="5000"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            {/* Calibrated Capacity (L) */}
            <div>
              <label className="block mb-1 font-semibold">Calibrated Capacity (L)</label>
              <input
                name="calibratedCapacity"
                type="number"
                value={form.calibratedCapacity}
                onChange={handleChange}
                placeholder="5000"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* Gross Weight (kg) */}
            <div>
              <label className="block mb-1 font-semibold">Gross Weight (kg)</label>
              <input
                name="grossWtKgs"
                type="number"
                value={form.grossWtKgs}
                onChange={handleChange}
                placeholder="16000"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* Month/Year */}
            <div>
              <label className="block mb-1 font-semibold">Month/Year</label>
              <input
                name="monthYear"
                value={form.monthYear}
                onChange={handleChange}
                placeholder="MM/YYYY or YYYY-MM"
                pattern="^(\d{2}\/\d{4}|\d{4}-\d{2})$"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* Totaliser Make */}
            <div>
              <label className="block mb-1 font-semibold">Totaliser Make</label>
              <input
                name="totaliserMake"
                value={form.totaliserMake}
                onChange={handleChange}
                placeholder="L&T"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            {/* Totaliser Model */}
            <div>
              <label className="block mb-1 font-semibold">Totaliser Model</label>
              <input
                name="totaliserModel"
                value={form.totaliserModel}
                onChange={handleChange}
                placeholder="T1000"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* PESO No */}
            <div>
              <label className="block mb-1 font-semibold">PESO No</label>
              <input
                name="pesoNo"
                value={form.pesoNo}
                onChange={handleChange}
                placeholder="PESO/XXXX/2025"
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>

            {/* Route */}
            <div>
              <label className="block mb-1 font-semibold">Route</label>
              <select
                name="route"
                value={form.route}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              >
                <option value="">— none —</option>
                {routes.map(r => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sensors */}
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center">
              <input
                name="dipStickYesNo"
                type="checkbox"
                checked={form.dipStickYesNo}
                onChange={handleChange}
                className="mr-2"
              /> Dipstick
            </label>
            <label className="inline-flex items-center">
              <input
                name="gpsYesNo"
                type="checkbox"
                checked={form.gpsYesNo}
                onChange={handleChange}
                className="mr-2"
              /> GPS
            </label>
            <label className="inline-flex items-center">
              <input
                name="loadSensorYesNo"
                type="checkbox"
                checked={form.loadSensorYesNo}
                onChange={handleChange}
                className="mr-2"
              /> Load Sensor
            </label>
            <label className="inline-flex items-center">
              <input
                name="volSensor"
                type="checkbox"
                checked={form.volSensor}
                onChange={handleChange}
                className="mr-2"
              /> Volume Sensor
            </label>
          </div>

          {/* Compliance Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 font-semibold">Insurance Expiry</label>
              <input
                type="date"
                name="insuranceExpiryDt"
                value={form.insuranceExpiryDt}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold">Fitness Expiry</label>
              <input
                type="date"
                name="fitnessExpiryDt"
                value={form.fitnessExpiryDt}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold">Permit Expiry</label>
              <input
                type="date"
                name="permitExpiryDt"
                value={form.permitExpiryDt}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            {loading ? 'Adding…' : <><PlusIcon size={16} className="inline mr-2"/> Add Vehicle</>}
          </button>
        </form>
      </div>

      {/* SHOW EXISTING VEHICLES BELOW FORM */}
      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h3 className="text-xl font-medium mb-4">Existing Vehicles</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left text-sm font-semibold">#</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Vehicle No</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Depot</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Make</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Model</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Capacity (L)</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Calib. Cap. (L)</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Gross Wt (kg)</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Month/Year</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Totaliser</th>
              <th className="px-4 py-2 text-center text-sm font-semibold">Dipstick</th>
              <th className="px-4 py-2 text-center text-sm font-semibold">GPS</th>
              <th className="px-4 py-2 text-center text-sm font-semibold">Load</th>
              <th className="px-4 py-2 text-center text-sm font-semibold">Vol</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">PESO No</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Insurance</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Fitness</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Permit</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Route</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Created</th>
              <th className="px-4 py-2 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map((v, idx) => (
              <tr key={v._id} className="hover:bg-gray-50">
                {editingId === v._id ? (
                  <>
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <input
                        name="vehicleNo"
                        value={editForm.vehicleNo}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        name="depotCd"
                        value={editForm.depotCd}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">Select Depot</option>
                        {depots.map(d => (
                          <option key={d._id} value={d.depotCd}>
                            {d.depotCd} — {d.depotName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="make"
                        value={editForm.make}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="model"
                        value={editForm.model}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="capacityLtrs"
                        type="number"
                        value={editForm.capacityLtrs}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="calibratedCapacity"
                        type="number"
                        value={editForm.calibratedCapacity}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="grossWtKgs"
                        type="number"
                        value={editForm.grossWtKgs}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="monthYear"
                        value={editForm.monthYear}
                        onChange={handleEditChange}
                        placeholder="MM/YYYY or YYYY-MM"
                        pattern="^(\d{2}\/\d{4}|\d{4}-\d{2})$"
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="grid grid-cols-1 gap-1">
                        <input
                          name="totaliserMake"
                          value={editForm.totaliserMake}
                          onChange={handleEditChange}
                          placeholder="Make"
                          className="w-full border rounded px-2 py-1"
                        />
                        <input
                          name="totaliserModel"
                          value={editForm.totaliserModel}
                          onChange={handleEditChange}
                          placeholder="Model"
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        name="dipStickYesNo"
                        type="checkbox"
                        checked={editForm.dipStickYesNo}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        name="gpsYesNo"
                        type="checkbox"
                        checked={editForm.gpsYesNo}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        name="loadSensorYesNo"
                        type="checkbox"
                        checked={editForm.loadSensorYesNo}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        name="volSensor"
                        type="checkbox"
                        checked={editForm.volSensor}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        name="pesoNo"
                        value={editForm.pesoNo}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        name="insuranceExpiryDt"
                        value={editForm.insuranceExpiryDt}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        name="fitnessExpiryDt"
                        value={editForm.fitnessExpiryDt}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        name="permitExpiryDt"
                        value={editForm.permitExpiryDt}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        name="route"
                        value={editForm.route}
                        onChange={handleEditChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">— none —</option>
                        {routes.map(r => (
                          <option key={r._id} value={r._id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {new Date(v.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 flex justify-center gap-2">
                      <button
                        onClick={submitEdit}
                        disabled={editLoading}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Save"
                      >
                        <SaveIcon size={16}/>
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={editLoading}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Cancel"
                      >
                        <XIcon size={16}/>
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-sm">{idx + 1}</td>
                    <td className="px-4 py-2 text-sm">{v.vehicleNo}</td>
                    <td className="px-4 py-2 text-sm">{v.depotCd}</td>
                    <td className="px-4 py-2 text-sm">{v.make || '–'}</td>
                    <td className="px-4 py-2 text-sm">{v.model || '–'}</td>
                    <td className="px-4 py-2 text-sm">{v.capacityLtrs ?? '–'}</td>
                    <td className="px-4 py-2 text-sm">{v.calibratedCapacity ?? '–'}</td>
                    <td className="px-4 py-2 text-sm">{v.grossWtKgs ?? '–'}</td>
                    <td className="px-4 py-2 text-sm">{v.monthYear || '–'}</td>
                    <td className="px-4 py-2 text-sm">
                      {(v.totaliserMake || v.totaliserModel)
                        ? `${v.totaliserMake || ''}${v.totaliserMake && v.totaliserModel ? ' / ' : ''}${v.totaliserModel || ''}`
                        : '–'}
                    </td>
                    <td className="px-4 py-2 text-center text-sm">
                      {v.dipStickYesNo ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-center text-sm">
                      {v.gpsYesNo ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-center text-sm">
                      {v.loadSensorYesNo ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-center text-sm">
                      {v.volSensor ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-sm">{v.pesoNo || '–'}</td>
                    <td className="px-4 py-2 text-sm">{fmtDate(v.insuranceExpiryDt)}</td>
                    <td className="px-4 py-2 text-sm">{fmtDate(v.fitnessExpiryDt)}</td>
                    <td className="px-4 py-2 text-sm">{fmtDate(v.permitExpiryDt)}</td>
                    <td className="px-4 py-2 text-sm">{v.route?.name || '–'}</td>
                    <td className="px-4 py-2 text-sm">{new Date(v.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 flex justify-center gap-2">
                      <button
                        onClick={() => startEdit(v)}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2Icon size={16}/>
                      </button>
                      <button
                        onClick={() => handleDelete(v._id)}
                        className="p-2 hover:bg-red-100 rounded"
                        title="Delete"
                      >
                        <Trash2Icon size={16}/>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!vehicles.length && (
              <tr>
                <td colSpan="22" className="px-4 py-2 text-center text-sm text-gray-500">
                  No vehicles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
