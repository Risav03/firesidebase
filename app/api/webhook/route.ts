import { NextRequest, NextResponse } from "next/server";
import { handleFarcasterWebhookEvent } from "@/utils/serverActions";

export async function POST(request: NextRequest) {

    const requestJson = await request.json();

  const result = await handleFarcasterWebhookEvent(requestJson);

  return NextResponse.json(result.body, { status: result.status });

}
  