import { ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { triggerImmediateSync } from "../queue.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await triggerImmediateSync(session.shop);
  return json({ queued: true });
};
