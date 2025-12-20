import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {

    const requestJson = await request.json();

  // Parse and verify the webhook event
  let data:any;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
    // Events are signed by the app key of a user with a JSON Farcaster Signature.
  } catch (e: unknown) {
    // Handle verification errors (invalid data, invalid app key, etc.)
    // Return appropriate error responses with status codes 400, 401, or 500
  }

  if (!data) {
    return NextResponse.json({ message: "Invalid webhook data" }, { status: 400 });
  }


  // Extract webhook data

  const fid = data.fid;
  const appFid = data.appFid; // The FID of the client app that the user added the Mini App to
  const event = data.event;

  console.log("Received webhook event:", event);
  console.log("For user FID:", fid);
  console.log("In app FID:", appFid);

// Handle different event types

  return NextResponse.json({ message: "Webhook received successfully" }, { status: 200 });

}
  