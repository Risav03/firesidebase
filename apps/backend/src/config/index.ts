/**
 * Centralized Configuration
 * 
 * All environment variables are loaded and validated here.
 * Other modules should import from this config instead of using process.env directly.
 */

interface Config {
  // Server Configuration
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  adsWebhookUrl: string;

  // Database Configuration
  mongodbUri: string;
  redisUrl: string;

  // External APIs
  neynarApiKey: string;
  hundredMsManagementToken: string;
  hundredMsTemplateId: string;

  // RealtimeKit (Cloudflare) Configuration
  realtimekitApiKey: string;
  realtimekitOrgId: string;
  realtimekitBaseUrl: string;

  // Authentication
  devHeader?: string;
  devJwtDomain?: string;
  adminToken?: string;

  // AWS/S3 Configuration
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  s3BucketName: string;

  // Feature Flags
  isDevelopment: boolean;

  // Dynamic Methods
  getHostname: (request?: any) => string;

  // Ads/Webhooks
  adsWebhookSecret: string;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value!;
};

const getOptionalEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
};

const frontendUrl = getEnvVar('FRONTEND_URL', 'http://localhost:3000');
const normalizedFrontendUrl = frontendUrl.replace(/\/$/, '');

export const config = {
  // Server Configuration
  port: getEnvNumber('PORT', 8000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  frontendUrl,
  adsWebhookUrl: getOptionalEnvVar('ADS_WEBHOOK_URL', `${normalizedFrontendUrl}/api/webhooks/ads`),

  // Database Configuration
  mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/fireside'),
  redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),

  // External APIs
  neynarApiKey: getOptionalEnvVar('NEYNAR_API_KEY', ''),
  hundredMsManagementToken: getOptionalEnvVar('HUNDRED_MS_MANAGEMENT_TOKEN', ''),
  hundredMsTemplateId: getOptionalEnvVar('HUNDRED_MS_TEMPLATE_ID', ''),
  
  // RealtimeKit (Cloudflare) Configuration
  // Get credentials from: https://dash.realtime.cloudflare.com
  // Docs: https://docs.realtime.cloudflare.com
  realtimekitApiKey: getOptionalEnvVar('REALTIMEKIT_API_KEY', ''),
  realtimekitOrgId: getOptionalEnvVar('REALTIMEKIT_ORG_ID', ''),
  realtimekitBaseUrl: getOptionalEnvVar('REALTIMEKIT_BASE_URL', 'https://api.realtime.cloudflare.com/v2'),

  // Authentication
  devHeader: getOptionalEnvVar('DEV_HEADER'),
  devJwtDomain: getOptionalEnvVar('DEV_JWT_DOMAIN'),
  adminToken: getOptionalEnvVar('ADMIN_TOKEN'),
  // Set ENABLE_DEV_AUTH=true to use DEV_HEADER even in production (for testing)
  enableDevAuth: getOptionalEnvVar('ENABLE_DEV_AUTH', 'false') === 'true',

  // AWS/S3 Configuration
  awsRegion: getEnvVar('AWS_REGION', 'us-east-1'),
  awsAccessKeyId: getEnvVar('AWS_ACCESS_KEY_ID'),
  awsSecretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY'),
  s3BucketName: getEnvVar('S3_BUCKET_NAME', 'fireside-assets'),

  // Feature Flags
  isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',

  // Ads/Webhooks
  adsWebhookSecret: getEnvVar('ADS_WEBHOOK_SECRET'),

  // Dynamic Methods
  getHostname: (request?: any) => {
    // In development, use explicit dev domain if configured
    if (config.isDevelopment && config.devJwtDomain) {
      console.log("🔒 Using DEV_JWT_DOMAIN for hostname:", config.devJwtDomain);
      return config.devJwtDomain;
    }
    
    // Case-insensitive check for host headers
    const headers = request?.headers || {};

    console.log("This is headersssss: ",headers);
    
    let hostHeader = '';
    
    if (headers['origin'] || headers['Origin']) {
      hostHeader = headers['origin'] || headers['Origin'] || '';
    } 
    else if (typeof headers.get === 'function') {
      hostHeader = headers.get('origin') || headers.get('Origin') || '';
    }

    else if (headers instanceof Object) {
      // Convert headers to a standard object if it's an iterable Headers-like object
      const headerEntries = Object.entries(headers);
      for (const [key, value] of headerEntries) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'origin') {
          hostHeader = String(value);
          break;
        }
      }
    }
    
    console.log("🏠 Extracted host header:", hostHeader);
    if (hostHeader) {
      const hostname = hostHeader.split('https://')[1]; // Remove https:// if present
      console.log("🔒 Using programmatic hostname from request:", hostname);
      return hostname;
    }
    
    // Fallback to localhost for development when no dev domain is set
    console.log("🔒 Using fallback hostname: localhost");
    return 'localhost';
  },
};

const validateConfig = () => {
  const optional = [
    'NEYNAR_API_KEY',
    'HUNDRED_MS_MANAGEMENT_TOKEN', 
    'HUNDRED_MS_TEMPLATE_ID',
    'REALTIMEKIT_API_KEY',
    'REALTIMEKIT_ORG_ID'
  ];

  const awsRequired = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];

  const missingOptional = optional.filter(key => !process.env[key]);
  const missingAws = awsRequired.filter(key => !process.env[key]);
  
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Missing optional environment variables: ${missingOptional.join(', ')}`);
    console.warn('Some features may not work correctly.');
  }

  if (missingAws.length > 0) {
    console.warn(`⚠️  Missing AWS environment variables: ${missingAws.join(', ')}`);
    console.warn('S3 uploads will not work.');
  }
};

validateConfig();

export default config;
