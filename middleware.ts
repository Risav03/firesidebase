import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sdk from '@farcaster/miniapp-sdk';
import { createClient } from '@farcaster/quick-auth';

// This middleware runs on every request
export async function middleware(request: NextRequest) {

    console.log("Middleware called for path:", request.nextUrl.pathname);
  
      const authorization = request.headers.get("Authorization");

      console.log("Authorization header in middleware:", authorization);
    
      if (!authorization) {
        return NextResponse.json({ status: 401, statusText: "Unauthorized" });
      }
    
      const user = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/me`, {
        headers: {
          "Authorization": authorization,
        },
      });

      const userJson = await user.json();

      console.log("User from /api/me in middleware:", user);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-fid', userJson.fid.toString());

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

