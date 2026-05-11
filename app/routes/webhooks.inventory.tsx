import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { triggerImmediateSync } from "../queue.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  if (topic !== "INVENTORY_LEVELS_UPDATE") return new Response("ok");
  await triggerImmediateSync(shop);
  return new Response("ok");
};
