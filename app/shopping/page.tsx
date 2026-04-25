import { getShoppingList } from "@/lib/server/data";
import { ShoppingListClient } from "./shopping-client";

export default async function ShoppingPage() {
  const items = await getShoppingList();
  return <ShoppingListClient initialItems={items} />;
}
