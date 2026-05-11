import { DataTable, Badge, Text } from "@shopify/polaris";

interface SyncError {
  id: string;
  ebayItemId: string | null;
  message: string;
  createdAt: string;
  syncStatus: string;
}

interface Props {
  errors: SyncError[];
}

export function ErrorLogTable({ errors }: Props) {
  if (errors.length === 0) {
    return <Text as="p" variant="bodyMd" tone="subdued">No errors recorded. All syncs have completed successfully.</Text>;
  }

  const rows = errors.map((e) => [
    e.ebayItemId ?? "—",
    e.message,
    <Badge key={e.id} tone={e.syncStatus === "FAILED" ? "critical" : "warning"}>{e.syncStatus}</Badge>,
    new Date(e.createdAt).toLocaleString(),
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "text", "text", "text"]}
      headings={["eBay Item ID", "Error", "Sync Status", "Time"]}
      rows={rows}
    />
  );
}
