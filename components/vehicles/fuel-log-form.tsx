"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Hearth tokens, same as the manage page. text-base on fields is deliberate:
// anything smaller makes iOS zoom when you tap into it, which is miserable
// standing at a pump.
const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/50 focus:outline-none";
const label = "mb-1 block text-xs text-slate-400";

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

interface FuelLogFormProps {
  vehicleId?: string;
  onSuccess?: () => void;
  lastReading?: number;
  /**
   * Pins the form to one vehicle, shown as plain text instead of a picker. Set
   * by the NFC sticker page, which already knows the car and has no session to
   * fetch the vehicle list with.
   */
  vehicleName?: string;
  /** Signed sticker token, forwarded so the POST is accepted without a session. */
  token?: string;
  /** Where to go after a successful save. Omitted for sticker taps. */
  redirectTo?: string;
}

export function FuelLogForm({
  vehicleId,
  onSuccess,
  lastReading,
  vehicleName,
  token,
  redirectTo,
}: FuelLogFormProps) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>(vehicleId || "");
  const [odometer, setOdometer] = useState("");
  const [gallons, setGallons] = useState("");
  const [cost, setCost] = useState("");
  const [location, setLocation] = useState("");
  const [fuelType, setFuelType] = useState("regular");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mpgDisplay, setMpgDisplay] = useState<number | null>(null);

  // Fetch vehicles on mount, unless the vehicle is already pinned.
  useEffect(() => {
    if (!vehicleName) fetchVehicles();
  }, [vehicleName]);

  // Calculate MPG
  useEffect(() => {
    if (lastReading && odometer && gallons) {
      const miles = parseInt(odometer) - lastReading;
      const gallonsNum = parseFloat(gallons);
      if (miles > 0 && gallonsNum > 0) {
        setMpgDisplay(Math.round((miles / gallonsNum) * 10) / 10);
      }
    }
  }, [odometer, gallons, lastReading]);

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!selectedVehicle) {
      setError("Pick a vehicle first.");
      setLoading(false);
      return;
    }

    if (!odometer) {
      setError("The odometer reading is required.");
      setLoading(false);
      return;
    }

    try {
      const query = token ? `?k=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/vehicles/${selectedVehicle}/logs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometer_miles: parseInt(odometer),
          gallons_pumped: gallons ? parseFloat(gallons) : null,
          cost_dollars: cost ? parseFloat(cost) : null,
          location: location || null,
          fuel_type: fuelType || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Couldn't save the fill-up.");
      }

      setSuccess(true);
      // Reset form
      setOdometer("");
      setGallons("");
      setCost("");
      setLocation("");
      setNotes("");
      setMpgDisplay(null);

      setTimeout(() => setSuccess(false), 3000);
      onSuccess?.();
      if (redirectTo) setTimeout(() => router.push(redirectTo), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-stone border border-edge bg-ink-900 p-4"
    >
      <h2 className="font-display text-xl">Fill-up</h2>

      {error && (
        <p className="rounded-lg border border-signal-red/25 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-signal-green/25 bg-signal-green/10 px-3 py-2 text-sm text-signal-green">
          Fill-up logged.
        </p>
      )}

      {/* Vehicle — a picker normally, fixed text when opened from a sticker */}
      <div>
        <span className={label}>Vehicle</span>
        {vehicleName ? (
          <p className="rounded-lg border border-edge bg-ink-950 px-3 py-2 text-base text-slate-100">
            {vehicleName}
          </p>
        ) : (
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            aria-label="Vehicle"
            className={input}
          >
            <option value="">Pick a vehicle…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.year && v.make && ` (${v.year} ${v.make})`}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className={label} htmlFor="odometer">
          Odometer
          {lastReading ? (
            <span className="text-slate-500">
              {" "}
              · last {lastReading.toLocaleString()}
            </span>
          ) : null}
        </label>
        <input
          id="odometer"
          type="number"
          inputMode="numeric"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={lastReading ? String(lastReading + 300) : "142536"}
          className={input}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="gallons">
            Gallons
          </label>
          <input
            id="gallons"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={gallons}
            onChange={(e) => setGallons(e.target.value)}
            placeholder="12.5"
            className={input}
          />
        </div>
        <div>
          <label className={label} htmlFor="cost">
            Cost
          </label>
          <input
            id="cost"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="52.18"
            className={input}
          />
        </div>
      </div>

      {mpgDisplay && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-signal-blue/20 bg-signal-blue/10 px-3 py-2">
          <span className="text-sm text-slate-300">
            Est. MPG{" "}
            <strong className="font-display text-lg tabular-nums text-signal-blue">
              {mpgDisplay}
            </strong>
          </span>
          {cost && gallons && (
            <span className="text-sm text-slate-400 tabular-nums">
              ${(parseFloat(cost) / parseFloat(gallons)).toFixed(2)}/gal
            </span>
          )}
        </div>
      )}

      <div>
        <label className={label} htmlFor="location">
          Where
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Shell — Oak St"
          className={input}
        />
      </div>

      <div>
        <label className={label} htmlFor="fuelType">
          Fuel
        </label>
        <select
          id="fuelType"
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
          className={input}
        >
          <option value="regular">Regular</option>
          <option value="premium">Premium</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Electric</option>
        </select>
      </div>

      <div>
        <label className={label} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Long highway trip…"
          rows={2}
          className={input}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-signal-blue px-4 py-3 text-base font-semibold text-ink-950 disabled:bg-ink-700 disabled:text-slate-500"
      >
        {loading ? "Saving…" : "Save fill-up"}
      </button>
    </form>
  );
}
