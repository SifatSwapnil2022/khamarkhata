import { PillTabs } from "@/components/ui";
import type { DairyDict } from "@/i18n/dairy";

export function DairyTabs({
  current,
  t,
  canRecord,
  canSales,
}: {
  current: "overview" | "record" | "sales";
  t: DairyDict;
  canRecord: boolean;
  canSales: boolean;
}) {
  const items = [{ key: "overview", href: "/app/dairy", label: t.tabs.overview }];
  if (canRecord) items.push({ key: "record", href: "/app/dairy/record", label: t.tabs.record });
  if (canSales) items.push({ key: "sales", href: "/app/dairy/sales", label: t.tabs.sales });
  return <PillTabs items={items} current={current} label={t.title} />;
}
