import { DataEditor } from "@/components/data-editor";
import { getAdminCollections, getAdminResetTargets } from "@/lib/server/admin";

export default async function DataPage() {
  const [resources, resetTargets] = await Promise.all([
    getAdminCollections(),
    Promise.resolve(getAdminResetTargets()),
  ]);

  return <DataEditor resources={resources} resetTargets={resetTargets} />;
}
