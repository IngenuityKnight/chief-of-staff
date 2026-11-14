"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      setError("Please select a vehicle");
      setLoading(false);
      return;
    }

    if (!odometer) {
      setError("Odometer reading is required");
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
        throw new Error(data.message || data.error || "Failed to log fuel");
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
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-4 border rounded-lg">
      <h2 className="text-lg font-semibold">Fuel Fill-Up Log</h2>

      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      {success && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          ✓ Fill-up logged successfully
        </div>
      )}

      {/* Vehicle — a picker normally, fixed text when opened from a sticker */}
      <div>
        <label className="block text-sm font-medium mb-1">Vehicle</label>
        {vehicleName ? (
          <p className="px-3 py-2 bg-gray-50 border rounded-md text-sm">{vehicleName}</p>
        ) : (
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">Select a vehicle...</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.year && v.make && ` (${v.year} ${v.make})`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Odometer reading */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Odometer Reading *
          {lastReading && <span className="text-xs text-gray-500"> (last: {lastReading})</span>}
        </label>
        <input
          type="number"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder="142536"
          className="w-full px-3 py-2 border rounded-md text-sm"
          required
        />
      </div>

      {/* Gallons pumped */}
      <div>
        <label className="block text-sm font-medium mb-1">Gallons Pumped</label>
        <input
          type="number"
          step="0.01"
          value={gallons}
          onChange={(e) => setGallons(e.target.value)}
          placeholder="12.5"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      {/* Cost */}
      <div>
        <label className="block text-sm font-medium mb-1">Cost ($)</label>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="52.18"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      {/* MPG Display */}
      {mpgDisplay && (
        <div className="bg-blue-50 p-2 rounded text-sm">
          <span className="text-blue-900">
            Est. MPG: <strong>{mpgDisplay}</strong>
          </span>
          {cost && gallons && (
            <span className="text-blue-700 ml-3">
              Cost/gal: ${(parseFloat(cost) / parseFloat(gallons)).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Shell - Oak St"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      {/* Fuel type */}
      <div>
        <label className="block text-sm font-medium mb-1">Fuel Type</label>
        <select
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value="regular">Regular</option>
          <option value="premium">Premium</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Electric</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Long highway trip..."
          rows={2}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Saving..." : "Save Fill-Up"}
      </button>
    </form>
  );
}
