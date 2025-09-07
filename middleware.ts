import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs on every request
export async function middleware(request: NextRequest) {
  
      // Get fid from query parameter
      const url = new URL(request.url);
      let fid = url.searchParams.get('fid');
      const env = process.env.NEXT_PUBLIC_ENV;

      // Use dev FID if in development mode
      if(env == "DEV" && !fid){
        fid = process.env.NEXT_PUBLIC_DEV_FID || "1";
      }

      console.log("FID from query:", fid);

      if (!fid) {
        return NextResponse.json({ status: 401, statusText: "Unauthorized - Missing FID" }, { status: 401 });
      }
    
      const user = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/me?fid=${fid}`);
      const userJson = await user.json();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-fid', userJson.user.toString());

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

