import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sdk from '@farcaster/miniapp-sdk';
import { createClient } from '@farcaster/quick-auth';

// This middleware runs on every request
export async function middleware(request: NextRequest) {

    console.log("Middleware called for path:", request.nextUrl.pathname);
  
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

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-fid', user.fid.toString());

    // Create a new response with modified headers
    return NextResponse.next({
        request: {
            headers: requestHeaders
        }
    });
}

// Define the paths where the middleware should run
export const config = {
  matcher: ["/api/protected/:path*"],
};

