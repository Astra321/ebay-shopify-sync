import { DataTable, Badge, Link, Text } from "@shopify/polaris";

interface Mapping {
  id: string;
  ebayItemId: string;
  shopifyProductId: string;
  ebaysku: string | null;
  shopifySku: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
}

interface Props {
  mappings: Mapping[];
  shop: string;
}

export function SkuMappingTable({ mappings, shop }: Props) {
  const rows = mappings.map((m) => [
    m.ebaysku ?? m.ebayItemId,
    m.shopifySku ?? "—",
    <Link key={`product-${m.id}`} url={`https://${shop}/admin/products/${m.shopifyProductId}`} external>
      {m.shopifyProductId}
    </Link>,
    <Badge key={`badge-${m.id}`} tone={m.isActive ? "success" : "critical"}>{m.isActive ? "Active" : "Inactive"}</Badge>,
    m.lastSyncedAt ? new Date(m.lastSyncedAt).toLocaleString() : "Never",
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "text", "text", "text", "text"]}
      headings={["eBay SKU", "Shopify SKU", "Shopify Product", "Status", "Last Synced"]}
      rows={rows}
      footerContent={`${mappings.length} mappings total`}
    />
  );
}
