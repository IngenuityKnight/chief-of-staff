import { getShoppingList } from "@/lib/server/data";
import { ShoppingListClient } from "./shopping-client";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const params = await searchParams;
  const activeStore = params.store ?? "all";
  const items = await getShoppingList();
  return <ShoppingListClient initialItems={items} activeStore={activeStore} />;
}
