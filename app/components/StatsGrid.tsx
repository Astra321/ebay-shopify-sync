import { Card, Text, BlockStack, InlineStack, Icon, Box } from "@shopify/polaris";
import { ProductIcon, AlertCircleIcon, ClockIcon, CheckCircleIcon } from "@shopify/polaris-icons";

interface Stat {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  tone?: "success" | "critical" | "warning" | "base";
}

interface Props {
  totalMapped: number;
  lastSyncTime: string | null;
  nextSyncTime: string | null;
  errorCount: number;
  itemsSyncedLast: number;
}

export function StatsGrid({ totalMapped, lastSyncTime, nextSyncTime, errorCount, itemsSyncedLast }: Props) {
  const stats: Stat[] = [
    {
      label: "Mapped SKUs",
      value: String(totalMapped),
      icon: ProductIcon,
      tone: "base",
    },
    {
      label: "Items Synced (Last Run)",
      value: String(itemsSyncedLast),
      icon: CheckCircleIcon,
      tone: "success",
    },
    {
      label: "Sync Errors",
      value: String(errorCount),
      icon: AlertCircleIcon,
      tone: errorCount > 0 ? "critical" : "success",
    },
    {
      label: "Next Sync",
      value: nextSyncTime ?? "Not scheduled",
      icon: ClockIcon,
      tone: "base",
    },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <BlockStack gap="300">
            <InlineStack gap="200" align="start" blockAlign="center">
              <Box
                background={stat.tone === "critical" ? "bg-fill-critical-secondary" : stat.tone === "success" ? "bg-fill-success-secondary" : "bg-fill-secondary"}
                borderRadius="200"
                padding="200"
              >
                <Icon source={stat.icon} tone={stat.tone === "base" ? undefined : stat.tone} />
              </Box>
              <Text as="p" variant="bodySm" tone="subdued">{stat.label}</Text>
            </InlineStack>
            <Text as="p" variant="headingXl" fontWeight="bold">{stat.value}</Text>
          </BlockStack>
        </Card>
      ))}
    </div>
  );
}
