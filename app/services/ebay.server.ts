import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { db } from "../db.server";
import { decrypt, encrypt } from "./crypto.server";

const EBAY_API_URL = "https://api.ebay.com/ws/api.dll";
const EBAY_REST_BASE = "https://api.ebay.com";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export interface EbayCredentials {
  appId: string;
  certId: string;
  devId: string;
  authToken: string;
  sellerId: string;
  /** OAuth 2.0 access token — preferred over legacy authToken */
  accessToken?: string;
  /** OAuth 2.0 refresh token — for auto-refreshing access tokens */
  refreshToken?: string;
  /** Access token expiry time */
  accessTokenExpiry?: Date;
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

/**
 * eBay API client with dual support:
 * - OAuth 2.0 access tokens (preferred — modern REST API with auto-refresh)
 * - Legacy Auth'n'Auth tokens (fallback — XML Trading API)
 *
 * When OAuth credentials are available, the client automatically uses the
 * REST API and handles token refresh when access tokens expire.
 */
export class EbayClient {
  private creds: EbayCredentials;

  constructor(creds: EbayCredentials) {
    this.creds = creds;
  }

  /**
   * Returns true if OAuth 2.0 access token is available (preferred mode).
   */
  get usesOAuth(): boolean {
    return !!(this.creds.accessToken || this.creds.refreshToken);
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary.
   * Only applies when using OAuth 2.0 mode.
   */
  private async ensureAccessToken(): Promise<string> {
    // If we have a valid (non-expired) access token, use it
    if (this.creds.accessToken) {
      if (this.creds.accessTokenExpiry && this.creds.accessTokenExpiry > new Date()) {
        return this.creds.accessToken;
      }
    }

    // Need to refresh using refresh token
    if (!this.creds.refreshToken) {
      throw new Error("eBay OAuth: No refresh token available. Please re-authorize the app.");
    }

    const creds = Buffer.from(`${this.creds.appId}:${this.creds.certId}`).toString("base64");
    const { data } = await axios.post(
      EBAY_TOKEN_URL,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.creds.refreshToken,
        scope: EBAY_OAUTH_SCOPES.join(" "),
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${creds}`,
        },
      }
    );

    this.creds.accessToken = data.access_token;
    this.creds.accessTokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    // Persist the refreshed token to DB (shop is needed for this — caller must handle if desired)
    return this.creds.accessToken;
  }

  // ─── Seller profile, orders, health-check ─────────────────────────

  async getSellerProfile(): Promise<{ username: string; email?: string; userId?: string } | null> {
    const token = await this.ensureAccessToken();
    try {
      const { data } = await axios.get(`${EBAY_REST_BASE}/commerce/identity/v1/user/`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      return { username: data?.username ?? "", email: data?.email, userId: data?.userId };
    } catch {
      return null;
    }
  }

  async getRecentOrders(limit = 10): Promise<Array<{
    orderId: string; creationDate: string; buyer: string;
    total: string; currency: string; status: string;
    items: Array<{ title: string; sku: string; quantity: number }>;
  }>> {
    const token = await this.ensureAccessToken();
    try {
      const { data } = await axios.get(`${EBAY_REST_BASE}/sell/fulfillment/v1/order`, {
        params: { limit, offset: 0 },
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      return (data?.orders ?? []).map((o: any) => ({
        orderId: o.orderId,
        creationDate: o.creationDate,
        buyer: o.buyer?.username ?? "—",
        total: o.pricingSummary?.total?.value ?? "0.00",
        currency: o.pricingSummary?.total?.currency ?? "USD",
        status: o.orderFulfillmentStatus ?? o.orderPaymentStatus ?? "—",
        items: (o.lineItems ?? []).map((li: any) => ({
          title: li.title ?? "", sku: li.sku ?? "", quantity: Number(li.quantity ?? 0),
        })),
      }));
    } catch {
      return [];
    }
  }

  async ping(): Promise<boolean> {
    try { await this.ensureAccessToken(); return true; } catch { return false; }
  }

  // ─── OAuth 2.0 REST API methods (preferred) ───────────────────────

  /**
   * Fetch seller listings via eBay Inventory API (OAuth 2.0).
   * Uses the Sell Inventory REST endpoint which returns JSON natively.
   */
  async getSellerListingsOAuth(): Promise<EbayListing[]> {
    const token = await this.ensureAccessToken();
    const results: EbayListing[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { data } = await axios.get(
        `${EBAY_REST_BASE}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const items = data.inventoryItems ?? [];
      for (const item of items) {
        results.push({
          itemId: item.sku,
          title: item.product?.title ?? "",
          quantity: item.availability?.shipToLocationAvailability?.quantity ?? 0,
          price: Number(item.offerSummary?.lowestPrice?.value ?? 0),
          description: item.product?.description ?? "",
          images: (item.product?.imageUrls ?? []).slice(0, 12),
          variants: [],
          category: item.product?.categoryPath ?? undefined,
        });
      }

      hasMore = items.length === limit;
      offset += limit;
    }

    return results;
  }

  /**
   * Create or replace an eBay inventory item (full upsert via PUT).
   * Used for seeding test data. The PUT endpoint replaces the entire item,
   * so all required fields must be supplied.
   */
  async createOrReplaceInventoryItem(
    sku: string,
    item: {
      title: string;
      description: string;
      quantity: number;
      imageUrls?: string[];
      condition?: string;
      brand?: string;
    },
  ): Promise<void> {
    const token = await this.ensureAccessToken();

    await axios.put(
      `${EBAY_REST_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
      {
        availability: {
          shipToLocationAvailability: { quantity: Math.max(0, item.quantity) },
        },
        condition: item.condition ?? "NEW",
        product: {
          title: item.title,
          description: item.description,
          imageUrls: item.imageUrls ?? [],
          aspects: item.brand ? { Brand: [item.brand] } : undefined,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Language": "en-US",
          Accept: "application/json",
        },
      },
    );
  }

  /**
   * Get raw inventory item info (used by status/test endpoints).
   */
  async getInventoryItem(sku: string): Promise<{ quantity: number; title: string } | null> {
    const token = await this.ensureAccessToken();
    try {
      const { data } = await axios.get(
        `${EBAY_REST_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      return {
        quantity: data?.availability?.shipToLocationAvailability?.quantity ?? 0,
        title: data?.product?.title ?? "",
      };
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  /**
   * Delete an eBay inventory item (used for cleanup in tests).
   */
  async deleteInventoryItem(sku: string): Promise<void> {
    const token = await this.ensureAccessToken();
    try {
      await axios.delete(
        `${EBAY_REST_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
    }
  }

  /**
   * Update quantity via eBay Inventory API (OAuth 2.0).
   *
   * eBay requires quantity to be updated at BOTH the inventory item level
   * (shipToLocationAvailability) AND the offer level (availableQuantity).
   * Without the offer-level update, the live listing quantity won't change.
   *
   * Strategy: fetch published offers for the SKU, then issue a single
   * bulkUpdatePriceQuantity request covering both levels.
   */
  async updateQuantityOAuth(sku: string, quantity: number): Promise<void> {
    const token = await this.ensureAccessToken();
    const qty = Math.max(0, quantity);

    // Fetch offers for this SKU so we can update offer-level availableQuantity too
    let offers: Array<{ offerId: string; status?: string }> = [];
    try {
      const { data } = await axios.get(
        `${EBAY_REST_BASE}/sell/inventory/v1/offer`,
        {
          params: { sku },
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      offers = data.offers ?? [];
    } catch (err: any) {
      // 404 means no offers exist yet — inventory-level update only
      if (err?.response?.status !== 404) throw err;
    }

    const publishedOffers = offers.filter((o) => o.status === "PUBLISHED");

    await axios.post(
      `${EBAY_REST_BASE}/sell/inventory/v1/bulk_update_price_quantity`,
      {
        requests: [
          {
            sku,
            shipToLocationAvailability: { quantity: qty },
            ...(publishedOffers.length > 0
              ? {
                  offers: publishedOffers.map((o) => ({
                    offerId: o.offerId,
                    availableQuantity: qty,
                  })),
                }
              : {}),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Language": "en-US",
        },
      },
    );
  }

  // ─── Legacy XML Trading API methods (fallback) ─────────────────────

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

  async getSellerListingsLegacy(): Promise<EbayListing[]> {
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

  async updateQuantityLegacy(itemId: string, quantity: number): Promise<void> {
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

  // ─── Unified API (auto-selects OAuth vs legacy) ────────────────────

  async getSellerListings(): Promise<EbayListing[]> {
    if (this.usesOAuth) {
      return this.getSellerListingsOAuth();
    }
    return this.getSellerListingsLegacy();
  }

  async getItemQuantities(itemIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const listings = await this.getSellerListings();
    for (const l of listings) {
      result[l.itemId] = l.quantity;
    }
    return result;
  }

  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (this.usesOAuth) {
      return this.updateQuantityOAuth(itemId, quantity);
    }
    return this.updateQuantityLegacy(itemId, quantity);
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

/**
 * Generate the eBay OAuth consent URL for the user to authorize the app.
 * After consent, eBay redirects back with an authorization code that
 * can be exchanged for access/refresh tokens via `exchangeEbayAuthCode()`.
 */
export const EBAY_OAUTH_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

export function getEbayAuthUrl(appId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: EBAY_OAUTH_SCOPES.join(" "),
    state,
  });
  return `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange an eBay OAuth authorization code for access and refresh tokens.
 */
export async function exchangeEbayAuthCode(
  appId: string,
  certId: string,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const creds = Buffer.from(`${appId}:${certId}`).toString("base64");

  const { data } = await axios.post(
    EBAY_TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${creds}`,
      },
    }
  );

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
