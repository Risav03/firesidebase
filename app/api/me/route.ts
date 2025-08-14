import { createClient } from "@farcaster/quick-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const client = createClient();
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return NextResponse.json({ status: 401, statusText: "Unauthorized" });
  }

  console.log("Authorization header from me:", authorization?.split(" ")[1] as string);

  const payload = await client.verifyJwt({
    token: authorization?.split(" ")[1] as string,
    domain: process.env.HOSTNAME as string,
  });

  const fidParam = payload.sub;
  if (!fidParam) {
    return NextResponse.json(
      { error: "Missing fid parameter" },
      { status: 401 }
    );
  }
  const fid = Number(fidParam);
  if (Number.isNaN(fid)) {
    return NextResponse.json(
      { error: "Invalid fid parameter" },
      { status: 401 }
    );
  }

  const res = await fetch(
      `https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`,
    )

    if (res.ok) {
      const { result } = await res.json()
      console.log("Primary address result:", result);
      return NextResponse.json({ user : result.address })
    }
}
