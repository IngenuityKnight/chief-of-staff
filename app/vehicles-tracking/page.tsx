"use client";

import { useState, useEffect } from "react";
import { FuelLogForm } from "@/components/vehicles/fuel-log-form";

// Hearth tokens, same set the manage page uses. The page previously styled
// itself with stock light-mode grays, which rendered near-white text on
// near-white fields against the app's dark shell.
const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/50 focus:outline-none";
const primary = "rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-ink-950";
const label = "mb-1 block text-xs text-slate-400";
const panel = "rounded-stone border border-edge bg-ink-900 p-5";

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  plate?: string;
}

interface VehicleLog {
  id: string;
  odometer_miles: number;
  gallons_pumped: number | null;
  cost_dollars: number | null;
  location: string | null;
  fuel_type: string;
  log_date: string;
}

interface Analytics {
  mpg_avg: number | null;
  cost_per_mile: number | null;
  cost_per_gallon: number | null;
  total_miles: number;
  total_cost: number;
  fill_ups: number;
  last_fill_up: string | null;
  trend_mpg: number | null;
  period: string;
}

export default function VehicleTrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("month");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    license_plate: "",
    vin: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  // Fetch logs and analytics when vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      fetchLogs();
      fetchAnalytics();
    }
  }, [selectedVehicle, period]);

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        if (data.length > 0) {
          setSelectedVehicle(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    }
  };

  const fetchLogs = async () => {
    if (!selectedVehicle) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle}/logs?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedVehicle) return;
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle}/analytics?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };

  const deleteLog = async (logId: string) => {
    if (!selectedVehicle) return;
    if (!confirm("Delete this log entry?")) return;

    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle}/logs/${logId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLogs(logs.filter((l) => l.id !== logId));
      }
    } catch (err) {
      console.error("Failed to delete log:", err);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    if (!createFormData.make || !createFormData.model || !createFormData.year) {
      setCreateError("Make, model and year are required");
      setCreateLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: createFormData.make,
          model: createFormData.model,
          year: createFormData.year,
          license_plate: createFormData.license_plate || null,
          vin: createFormData.vin || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create vehicle");
      }

      const newVehicle = await res.json();
      setVehicles([newVehicle, ...vehicles]);
      setSelectedVehicle(newVehicle.id);
      setShowCreateForm(false);
      setCreateFormData({
        make: "",
        model: "",
        year: new Date().getFullYear(),
        license_plate: "",
        vin: "",
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreateLoading(false);
    }
  };

  const currentVehicle = vehicles.find((v) => v.id === selectedVehicle);
  const lastReading = logs.length > 0 ? logs[0].odometer_miles : undefined;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="mb-6 font-display text-3xl font-semibold">Cars</h1>

        {/* Vehicle selector and add button */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <label className={label} htmlFor="vehicle-select">Vehicle</label>
            <select
              id="vehicle-select"
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className={input}
            >
              <option value="">Choose a vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.year && v.make ? `(${v.year} ${v.make})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={primary}
            >
              {showCreateForm ? "Cancel" : "+ Add Vehicle"}
            </button>
          </div>
        </div>

        {/* Create vehicle form */}
        {showCreateForm && (
          <div className={`mb-6 ${panel}`}>
            <h2 className="mb-4 font-display text-xl">Add a vehicle</h2>
            {createError && (
              <p className="mb-4 rounded-lg border border-signal-red/25 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">{createError}</p>
            )}
            <form onSubmit={handleCreateVehicle} className="space-y-4 max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Make *</label>
                  <input
                    type="text"
                    value={createFormData.make}
                    onChange={(e) => setCreateFormData({ ...createFormData, make: e.target.value })}
                    placeholder="e.g., Lexus"
                    className={input}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Model *</label>
                  <input
                    type="text"
                    value={createFormData.model}
                    onChange={(e) => setCreateFormData({ ...createFormData, model: e.target.value })}
                    placeholder="e.g., ES 350"
                    className={input}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Year *</label>
                  <input
                    type="number"
                    value={createFormData.year}
                    onChange={(e) => setCreateFormData({ ...createFormData, year: parseInt(e.target.value) })}
                    className={input}
                    required
                  />
                </div>
                <div>
                  <label className={label}>License Plate</label>
                  <input
                    type="text"
                    value={createFormData.license_plate}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, license_plate: e.target.value })
                    }
                    placeholder="e.g., 2GS2844"
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className={label}>VIN</label>
                <input
                  type="text"
                  value={createFormData.vin}
                  onChange={(e) => setCreateFormData({ ...createFormData, vin: e.target.value })}
                  placeholder="Vehicle Identification Number"
                  className={input}
                />
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full rounded-lg bg-signal-blue px-4 py-3 text-base font-semibold text-ink-950 disabled:bg-ink-700 disabled:text-slate-500"
              >
                {createLoading ? "Creating..." : "Create Vehicle"}
              </button>
            </form>
          </div>
        )}

        {selectedVehicle && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-1">
              <FuelLogForm
                vehicleId={selectedVehicle}
                lastReading={lastReading}
                onSuccess={() => {
                  fetchLogs();
                  fetchAnalytics();
                }}
              />
            </div>

            {/* Metrics and Logs */}
            <div className="lg:col-span-2 space-y-6">
              {/* Analytics */}
              {analytics && (
                <div className={panel}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Analytics</h2>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="month">This Month</option>
                      <option value="year">This Year</option>
                      <option value="all_time">All Time</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">MPG</div>
                      <div className="text-2xl font-bold">
                        {analytics.mpg_avg ? analytics.mpg_avg.toFixed(1) : "—"}
                      </div>
                      {analytics.trend_mpg && (
                        <div className={`text-xs ${analytics.trend_mpg > 0 ? "text-signal-green" : "text-signal-red"}`}>
                          {analytics.trend_mpg > 0 ? "↑" : "↓"} {Math.abs(analytics.trend_mpg)}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">Cost/Mile</div>
                      <div className="text-2xl font-bold">
                        {analytics.cost_per_mile ? `$${analytics.cost_per_mile.toFixed(2)}` : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">Cost/Gal</div>
                      <div className="text-2xl font-bold">
                        {analytics.cost_per_gallon ? `$${analytics.cost_per_gallon.toFixed(2)}` : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">Total Miles</div>
                      <div className="text-2xl font-bold">{analytics.total_miles.toLocaleString()}</div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">Total Cost</div>
                      <div className="text-2xl font-bold">
                        ${analytics.total_cost.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">Fill-ups</div>
                      <div className="text-2xl font-bold">{analytics.fill_ups}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Logs */}
              <div className={panel}>
                <h2 className="text-lg font-semibold mb-4">Recent Fill-ups</h2>
                {loading ? (
                  <div className="text-sm text-slate-400">Loading…</div>
                ) : logs.length === 0 ? (
                  <div className="text-sm text-slate-400">No fill-ups logged yet. MPG needs two.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Odometer</th>
                          <th className="text-left py-2 px-2">Gallons</th>
                          <th className="text-left py-2 px-2">Cost</th>
                          <th className="text-left py-2 px-2">Location</th>
                          <th className="text-left py-2 px-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className="border-b border-edge hover:bg-ink-850">
                            <td className="py-2 px-2 text-xs">
                              {new Date(log.log_date).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-2">{log.odometer_miles.toLocaleString()}</td>
                            <td className="py-2 px-2">{log.gallons_pumped || "—"}</td>
                            <td className="py-2 px-2">
                              {log.cost_dollars ? `$${log.cost_dollars.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-2 text-xs">{log.location || "—"}</td>
                            <td className="py-2 px-2">
                              <button
                                onClick={() => deleteLog(log.id)}
                                className="text-xs text-signal-red"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
