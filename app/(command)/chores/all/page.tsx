// /chores/all — every chore, searchable and filterable.

import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { listChores } from "@/lib/server/chores-store";
import { Page } from "@/components/command-shell";
import { ActionBanner, AddChoreButton, ChoreTabs } from "@/components/chores-ui";
import ChoreFilter from "./chore-filter";

export const dynamic = "force-dynamic";

export default async function AllChores({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const params = await searchParams;
  const { today } = await wallToday(household);
  const chores = (await listChores(household, today)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page title="All chores">
      <ChoreTabs current="/chores/all" />
      <ActionBanner params={params} />
      <ChoreFilter chores={chores} today={today} />
      <AddChoreButton />
    </Page>
  );
}
