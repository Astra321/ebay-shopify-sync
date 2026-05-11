import { Banner, Text } from "@shopify/polaris";

interface Props {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "RUNNING" | null;
  lastSyncTime: string | null;
}

export function SyncStatusBanner({ status, lastSyncTime }: Props) {
  if (!status) return null;

  const config = {
    SUCCESS: { tone: "success" as const, title: "Last sync completed successfully" },
    PARTIAL: { tone: "warning" as const, title: "Last sync completed with some errors" },
    FAILED: { tone: "critical" as const, title: "Last sync failed" },
    RUNNING: { tone: "info" as const, title: "Sync is currently running..." },
  };

  const { tone, title } = config[status];

  return (
    <Banner tone={tone} title={title}>
      {lastSyncTime && (
        <Text as="p" variant="bodyMd">
          {status === "RUNNING" ? "Started" : "Completed"} at {new Date(lastSyncTime).toLocaleString()}
        </Text>
      )}
    </Banner>
  );
}
