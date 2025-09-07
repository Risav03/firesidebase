import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs on every request
export async function middleware(request: NextRequest) {
  
      let authorization;

      const env = process.env.NEXT_PUBLIC_ENV;

      

      if(env == "DEV"){
        authorization = `Bearer ${process.env.DEV_HEADER as string}`;
      }
      else{
        authorization = request.headers.get("Authorization");
      }

      console.log("Authorization header:", authorization);

      if (!authorization) {
        return NextResponse.json({ status: 401, statusText: "Unauthorized" });
      }
    
      const user = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/me`, {
        headers: {
          "Authorization": authorization,
        },
      });

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

