"use client";

import { useParams, useRouter } from "next/navigation";
import { FuelLogForm } from "@/components/vehicles/fuel-log-form";
import { useEffect, useState } from "react";

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

export default function QuickLogPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [lastReading, setLastReading] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        // Get vehicle details
        const vehicleRes = await fetch(`/api/vehicles`);
        if (vehicleRes.ok) {
          const vehicles = await vehicleRes.json();
          const found = vehicles.find((v: Vehicle) => v.id === vehicleId);
          if (found) {
            setVehicle(found);

            // Get last reading
            const logsRes = await fetch(`/api/vehicles/${vehicleId}/logs?limit=1`);
            if (logsRes.ok) {
              const data = await logsRes.json();
              if (data.logs && data.logs.length > 0) {
                setLastReading(data.logs[0].odometer_miles);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch vehicle data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) {
      fetchVehicleData();
    }
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Vehicle not found</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-center">Quick Fill-Up Log</h1>
          <p className="text-center text-gray-600 text-sm mt-2">
            {vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make}` : ""} {vehicle.name}
          </p>
        </div>

        <FuelLogForm
          vehicleId={vehicleId}
          lastReading={lastReading}
          onSuccess={() => {
            // Redirect to main tracking page after successful log
            setTimeout(() => router.push("/vehicles-tracking"), 2000);
          }}
        />

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/vehicles-tracking")}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
