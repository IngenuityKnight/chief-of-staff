// Admin settings (payday frequency, bucket splits, min wage)
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { cookies } from "next/headers";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const householdId = cookieStore.get("household_id")?.value;
  if (!householdId) return <div>Unauthorized</div>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return <div>Database error</div>;

  const { data: paydaySettings } = await supabase
    .from("payday_settings")
    .select("id, frequency, anchor_day, active")
    .eq("household_id", householdId)
    .maybeSingle();

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Settings</h2>
      
      <div className="max-w-2xl space-y-8">
        {/* Payday Settings */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Payday Schedule</h3>
          {paydaySettings ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
                <select className="px-3 py-2 border border-slate-300 rounded-md" defaultValue={(paydaySettings as any).frequency}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Anchor Day</label>
                <select className="px-3 py-2 border border-slate-300 rounded-md" defaultValue={(paydaySettings as any).anchor_day}>
                  <option value="monday">Monday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          ) : (
            <p className="text-slate-600 mb-4">Set up payday for your household</p>
          )}
        </div>

        {/* Bucket Splits */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Bucket Splits</h3>
          <p className="text-slate-600 mb-4">Configure how payday earnings are split across buckets</p>
          <div className="space-y-3">
            {["Give", "Save", "Spend", "Invest"].map((bucket) => (
              <div key={bucket} className="flex items-center gap-4">
                <label className="w-20 text-sm font-medium text-slate-700">{bucket}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="25"
                  className="w-20 px-3 py-2 border border-slate-300 rounded-md"
                />
                <span className="text-sm text-slate-600">%</span>
              </div>
            ))}
          </div>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Save Splits
          </button>
        </div>
      </div>
    </div>
  );
}
