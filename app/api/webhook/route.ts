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


  // Extract webhook data

  const fid = data.fid;
  const appFid = data.appFid; // The FID of the client app that the user added the Mini App to
  const event = data.event;

// Handle different event types

try {
  switch (event.event) {
    case "miniapp_added":
      if (event.notificationDetails) {
       return NextResponse.json({ message: "Notification details received" }, { status: 200 });
      }
       break;

    // case "miniapp_removed":
    //  // Delete notification details
    //   await deleteUserNotificationDetails(fid, appFid);
    //   break;

    // case "notifications_enabled":
    //   // Save new notification details and send confirmation
    //    setUserNotificationDetails(fid, appFid, event.notificationDetails);
    //    sendMiniAppNotification({
    //     fid,
    //     appFid,
    //     title: "Ding ding ding",
    //     body: "Notifications are now enabled",
    //   });
    //   break;

    // case "notifications_disabled":
    //      // Delete notification details
    //   await deleteUserNotificationDetails(fid, appFid);
    //   break;
    default:
      console.log("Unhandled event type:", event.event);
  }
} catch (error) {
  console.error("Error processing webhook:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
}

}
  