// /chores/[id]/edit — change a chore's details or cadence.

import { notFound } from "next/navigation";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { getChore, listChores, suggestions } from "@/lib/server/chores-store";
import { Card, Page } from "@/components/command-shell";
import ChoreForm from "../../chore-form";

export const dynamic = "force-dynamic";

export default async function EditChore({ params }: { params: Promise<{ id: string }> }) {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { id } = await params;
  const { today } = await wallToday(household);
  const [chore, all] = await Promise.all([getChore(household, id, today), listChores(household, today)]);
  if (!chore) notFound();
  const { rooms, people } = suggestions(all);

  return (
    <Page title="Edit chore" subtitle={chore.name}>
      <Card>
        <ChoreForm chore={chore} today={today} rooms={rooms} people={people} />
      </Card>
    </Page>
  );
}
