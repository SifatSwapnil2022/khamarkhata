import { PillTabs } from "@/components/ui";
import type { HealthDict } from "@/i18n/health";

export function HealthTabs({ current, t }: { current: "overview" | "vaccinate" | "treat"; t: HealthDict }) {
  return (
    <PillTabs
      label={t.title}
      current={current}
      items={[
        { key: "overview", href: "/app/health", label: t.tabs.overview },
        { key: "vaccinate", href: "/app/health/vaccinate", label: t.tabs.vaccinate },
        { key: "treat", href: "/app/health/treat", label: t.tabs.treat },
      ]}
    />
  );
}
