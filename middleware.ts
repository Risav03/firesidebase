import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware is disabled - just pass through all requests
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

// Don't run middleware on any routes
export const config = {
  matcher: [],
};

