import { createClient } from "@farcaster/quick-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  console.log("GET /api/me called");
  const client = createClient();
  const authorization = request.headers.get("Authorization");

  console.log("Authorization header:", authorization);
  if (!authorization) {
    return NextResponse.json({ status: 401, statusText: "Unauthorized" });
  }

  const payload = await client.verifyJwt({
    token: authorization?.split(" ")[1] as string,
    domain: process.env.HOSTNAME as string,
  });

  console.log("JWT payload:", payload);

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
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
    {
      headers: {
        "x-api-key": process.env.NEYNAR_API_KEY as string,
      },
    }
  );
  console.log("This is the raw response:", res);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Error fetching user from external API" },
      { status: res.status }
    );
  }
  const jsonRes = await res.json();
  console.log("This is the json response:", jsonRes);
  const user = jsonRes.users?.[0];
  return NextResponse.json({ fid, user });
}
