import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import sdk from '@farcaster/miniapp-sdk';

// This middleware runs on every request
export default async function middleware(request: NextRequest) {

    console.log("Middleware called for path:", request.nextUrl.pathname);
  
    const res = await sdk.quickAuth.fetch("/api/me");
    const user = await res.json();

    console.log("Middleware user data:", user);

    if(!user.user){
        return NextResponse.json({status: 401, statusText: 'Unauthorized'});
    }

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

