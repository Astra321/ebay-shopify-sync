import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

import { EbayClient } from "../app/services/ebay.server";

const creds = {
  appId: "APP",
  certId: "CERT",
  devId: "DEV",
  authToken: "TOKEN",
  sellerId: "SELLER",
};

describe("EbayClient.getSellerListings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed listings", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: `<?xml version="1.0"?>
      <GetSellerListResponse>
        <ItemArray>
          <Item>
            <ItemID>123</ItemID>
            <Title>Test Item</Title>
            <Quantity>10</Quantity>
            <SellingStatus><CurrentPrice currencyID="USD">29.99</CurrentPrice></SellingStatus>
            <PictureDetails><PictureURL>https://example.com/img.jpg</PictureURL></PictureDetails>
          </Item>
        </ItemArray>
        <HasMoreItems>false</HasMoreItems>
      </GetSellerListResponse>`,
    });

    const client = new EbayClient(creds);
    const listings = await client.getSellerListings();
    expect(listings).toHaveLength(1);
    expect(listings[0].itemId).toBe("123");
    expect(listings[0].quantity).toBe(10);
    expect(listings[0].price).toBe(29.99);
  });
});

describe("EbayClient.updateQuantity", () => {
  it("calls ReviseInventoryStatus with correct payload", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: `<ReviseInventoryStatusResponse><Ack>Success</Ack></ReviseInventoryStatusResponse>`,
    });
    const client = new EbayClient(creds);
    await client.updateQuantity("123", 5);
    expect(mockedAxios.post).toHaveBeenCalledOnce();
    const call = (mockedAxios.post as any).mock.calls[0];
    expect(call[1]).toContain("ReviseInventoryStatus");
    expect(call[1]).toContain("<Quantity>5</Quantity>");
  });
});
