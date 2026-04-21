import { DataEditor } from "@/components/data-editor";
import { getAdminCollections } from "@/lib/server/admin";

export default async function DataPage() {
  const resources = await getAdminCollections();
  return <DataEditor resources={resources} />;
}
