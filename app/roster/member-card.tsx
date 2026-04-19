"use client";

import { Baby, Dog, Heart, User, UserCircle } from "lucide-react";
import { EditInline } from "@/components/edit-inline";
import type { AdminField } from "@/lib/server/admin";
import type { HouseMember } from "@/lib/types";

const ROLE_META = {
  principal: { label: "Principal", icon: UserCircle },
  partner: { label: "Partner", icon: Heart },
  child: { label: "Child", icon: Baby },
  pet: { label: "Pet", icon: Dog },
  guest: { label: "Guest", icon: User },
};

export function MemberCard({
  member,
  fields,
  colorMap,
}: {
  member: HouseMember;
  fields: AdminField[];
  colorMap: Record<string, string>;
}) {
  const roleMeta = ROLE_META[member.role];
  const Icon = roleMeta.icon;

  return (
    <div className="rounded-lg border border-edge bg-ink-900/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${colorMap[member.avatarColor] ?? colorMap.blue}`}>
          <Icon className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
        </div>
        <EditInline
          resource="household"
          id={member.id}
          fields={fields}
          values={{
            name: member.name,
            role: member.role,
            avatarColor: member.avatarColor,
            notes: member.notes ?? "",
          }}
          label={`Edit ${member.name}`}
        />
      </div>
      <div className="text-base font-semibold text-white">{member.name}</div>
      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{roleMeta.label}</div>
      {member.notes && <div className="mt-2 text-[11px] leading-relaxed text-slate-400">{member.notes}</div>}
    </div>
  );
}
