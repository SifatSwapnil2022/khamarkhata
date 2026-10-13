import { PillTabs } from "@/components/ui";
import type { BreedingDict } from "@/i18n/breeding";

export function BreedingTabs({ current, t }: { current: "overview" | "record"; t: BreedingDict }) {
  return (
    <PillTabs
      label={t.title}
      current={current}
      items={[
        { key: "overview", href: "/app/breeding", label: t.tabs.overview },
        { key: "record", href: "/app/breeding/record", label: t.tabs.record },
      ]}
    />
  );
}
