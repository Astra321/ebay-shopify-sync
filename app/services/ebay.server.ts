import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const EBAY_API_URL = "https://api.ebay.com/ws/api.dll";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export interface EbayCredentials {
  appId: string;
  certId: string;
  devId: string;
  authToken: string;
  sellerId: string;
}

export interface EbayListing {
  itemId: string;
  title: string;
  quantity: number;
  price: number;
  description: string;
  images: string[];
  variants: Array<{ name: string; value: string }>;
  weightKg?: number;
  category?: string;
}

export class EbayClient {
  constructor(private creds: EbayCredentials) {}

  private headers(callName: string) {
    return {
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-APP-NAME": this.creds.appId,
      "X-EBAY-API-CERT-NAME": this.creds.certId,
      "X-EBAY-API-DEV-NAME": this.creds.devId,
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "Content-Type": "text/xml",
    };
  }

  private authBlock() {
    return `<RequesterCredentials><eBayAuthToken>${this.creds.authToken}</eBayAuthToken></RequesterCredentials>`;
  }

  async getSellerListings(): Promise<EbayListing[]> {
    const results: EbayListing[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${this.authBlock()}
  <UserID>${this.creds.sellerId}</UserID>
  <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
  <GranularityLevel>Fine</GranularityLevel>
  <ActiveList>true</ActiveList>
  <StartTimeFrom>${new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString()}</StartTimeFrom>
  <StartTimeTo>${new Date().toISOString()}</StartTimeTo>
</GetSellerListRequest>`;

      const { data } = await axios.post(EBAY_API_URL, xml, { headers: this.headers("GetSellerList") });
      const parsed = parser.parse(data);
      const resp = parsed.GetSellerListResponse;
      const items = [resp.ItemArray?.Item].flat().filter(Boolean);

      for (const item of items) {
        results.push(this.parseItem(item));
      }

      hasMore = resp.HasMoreItems === true || resp.HasMoreItems === "true";
      page++;
    }

    return results;
  }

  async getItemQuantities(itemIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // Fetch fresh quantities via GetSellerList (all active items)
    const listings = await this.getSellerListings();
    for (const l of listings) {
      result[l.itemId] = l.quantity;
    }

    return result;
  }

  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${this.authBlock()}
  <InventoryStatus>
    <ItemID>${itemId}</ItemID>
    <Quantity>${Math.max(0, quantity)}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

    await axios.post(EBAY_API_URL, xml, { headers: this.headers("ReviseInventoryStatus") });
  }

  private parseItem(item: any): EbayListing {
    const images = [item.PictureDetails?.PictureURL].flat().filter(Boolean);
    const specifics = [item.ItemSpecifics?.NameValueList].flat().filter(Boolean);

    return {
      itemId: String(item.ItemID),
      title: item.Title ?? "",
      quantity: Number(item.Quantity ?? 0),
      price: Number(item.SellingStatus?.CurrentPrice?.["#text"] ?? item.SellingStatus?.CurrentPrice ?? 0),
      description: item.Description ?? "",
      images,
      variants: specifics.map((s: any) => ({ name: s.Name, value: [s.Value].flat()[0] })),
      weightKg: item.ShippingDetails?.CalculatedShippingRate?.WeightMajor ?? undefined,
      category: item.PrimaryCategory?.CategoryName ?? undefined,
    };
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
