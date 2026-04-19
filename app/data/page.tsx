import { DataEditor } from "@/components/data-editor";
import { getAdminCollections, isAdminEditingEnabled } from "@/lib/server/admin";

export default async function DataPage() {
  const resources = await getAdminCollections();
  const editingEnabled = isAdminEditingEnabled();

  return <DataEditor resources={resources} editingEnabled={editingEnabled} />;
}
