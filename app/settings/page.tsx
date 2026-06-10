import { Panel } from "@/components/ui";
import { getHouseholdContext } from "@/lib/server/data";
import { SettingsForm } from "@/components/settings-form";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const ctx = await getHouseholdContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-signal-blue/10">
          <Settings className="h-4 w-4 text-signal-blue" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-white">Household Settings</h1>
          <p className="text-sm text-slate-500">Configures the AI context used across every feature</p>
        </div>
      </div>

      <Panel>
        <SettingsForm ctx={ctx} />
      </Panel>
    </div>
  );
}
