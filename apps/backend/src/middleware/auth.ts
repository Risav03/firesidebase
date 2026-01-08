import { createClient } from '@farcaster/quick-auth';
import config from '../config';

/**
 * Authentication middleware that validates authorization headers and fetches user data
 * This middleware sets the x-user-fid header for downstream use, making it compatible
 * with your existing route patterns.
 */
export const authMiddleware = async ({ set, headers, request }: { set: any, headers: any, request?: any }) => {
    console.log('🔐 AUTH MIDDLEWARE HIT');
    try {
      const client = createClient();
      let authorization: string | null = null;

      // In development mode, use DEV_HEADER if available
      if (config.isDevelopment && config.devHeader) {
        authorization = `Bearer ${config.devHeader}`;
        console.log("🛠️  Using development header for authentication");
      } else {
        // Get authorization from request headers
        authorization = headers.authorization || null;
        console.log("📤 Using authorization from request headers");
      }

      console.log("🔑 Authorization header present:", !!authorization);

      if (!authorization) {
        console.log("❌ No authorization header found");
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Missing authorization header"
        };
      }

      // Extract token from Bearer authorization header
      const token = authorization.split(" ")[1];
      if (!token) {
        console.log("❌ Invalid authorization header format");
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Invalid authorization header format"
        };
      }

      console.log("🔍 Verifying JWT token...");
      
      const verificationDomain = process.env.DEV_JWT_DOMAIN as string;
      
      console.log("🌐 Using verification domain:", verificationDomain);

      console.log("Token: ", token)
      
      // Verify JWT directly using Farcaster quick-auth
      const payload = await client.verifyJwt({
        token: token,
        domain: verificationDomain,
      });

      console.log("📦 JWT payload:", payload);

      const fidParam = payload.sub;
      if (!fidParam) {
        console.log("❌ Missing fid in JWT payload");
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Missing fid in token"
        };
      }

      const fid = Number(fidParam);
      if (Number.isNaN(fid)) {
        console.log("❌ Invalid fid in JWT payload:", fidParam);
        set.status = 401;
        return {
          success: false,
          error: "Unauthorized - Invalid fid in token"
        };
      }

      const userFid = fid.toString();
      console.log(`✅ User authenticated: FID ${userFid}`);
      console.log('🏁 AUTH MIDDLEWARE COMPLETED SUCCESSFULLY');

      // Set the x-user-fid header for downstream use (compatible with existing routes)
      headers['x-user-fid'] = userFid;

    } catch (error) {
      console.error('💥 AUTH MIDDLEWARE ERROR:', error);
      console.error('🚨 Error type:', error instanceof Error ? error.constructor.name : typeof error);
      if (error instanceof Error) {
        console.error('🚨 Error message:', error.message);
      }
      set.status = 500;
      return {
        success: false,
        error: "Internal server error during authentication",
        ...(config.isDevelopment && error instanceof Error && { details: error.message })
      };
    }
  };
