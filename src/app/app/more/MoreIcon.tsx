"use client";

import { ICONS, type IconName } from "../NavLinks";

export function MoreIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  return (
    <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
      <Icon className="size-5" />
    </span>
  );
}
