// /chores/new — add a chore.

import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { listChores, suggestions } from "@/lib/server/chores-store";
import { Card, Page } from "@/components/command-shell";
import ChoreForm from "../chore-form";

export const dynamic = "force-dynamic";

export default async function NewChore() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { today } = await wallToday(household);
  const { rooms, people } = suggestions(await listChores(household, today));

  return (
    <Page title="New chore">
      <Card>
        <ChoreForm today={today} rooms={rooms} people={people} />
      </Card>
    </Page>
  );
}
