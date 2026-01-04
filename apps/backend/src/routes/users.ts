import { Elysia, t } from 'elysia';
import User from '../models/User';
import Room from '../models/Room';
import RoomParticipant from '../models/RoomParticipant';
import { errorResponse, successResponse } from '../utils';
import { authMiddleware } from '../middleware/auth';
import { UpdateUserTopicsRequestSchema } from '../schemas/requests';
import { 
  GetUserResponseSchema, 
  HandleUserResponseSchema, 
  GetUserProfileByUsernameResponseSchema,
  UpdateUserResponseSchema,
  ErrorResponse,
  UserSchema as DocUserSchema,
  RoomSchema
} from '../schemas/documentation';
import config from '../config';
import '../config/database';

// Documentation schemas
const UserSchema = t.Object({
  _id: t.String({ description: 'MongoDB ObjectId' }),
  fid: t.Number({ description: 'Farcaster ID' }),
  username: t.String({ description: 'Username' }),
  displayName: t.String({ description: 'Display name' }),
  pfp_url: t.String({ description: 'Profile picture URL' }),
  wallet: t.Optional(t.String({ description: 'Primary wallet address' })),
  topics: t.Optional(t.Array(t.String(), { description: 'User interest topics' })),
  socials: t.Optional(t.Record(t.String(), t.String(), { description: 'Social platform links' })),
  autoAdsEnabled: t.Optional(t.Boolean({ description: 'Auto-enable ads for new rooms' }))
});

export const userRoutes = new Elysia({ prefix: '/users' })
  .group('/public', (app) =>
    app
      // Get user by FID
      .get('/:fid', async ({ params, set }) => {
        try {
          const fid = parseInt(params.fid);
          if (isNaN(fid)) {
            set.status = 400;
            return errorResponse('Invalid FID parameter');
          }

          const user = await User.findOne({ fid });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ user });
        } catch (error) {
          console.error('Error fetching user:', error);
          set.status = 500;
          return errorResponse('Failed to fetch user');
        }
      }, {
        params: t.Object({
          fid: t.String({ description: 'Farcaster ID of the user' })
        }),
        response: {
          200: GetUserResponseSchema,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Users'],
          summary: 'Get User by FID',
          description: `
Retrieves a user by their Farcaster ID (FID).

**Use Case:**
Look up user information when you have their FID.

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get user by username with hosted rooms
      .get('/username/:username', async ({ params, set }) => {
        try {
          const { username } = params;

          console.log("Fetching data for username:", username);
          
          // Fetch user by username
          const user = await User.findOne({ username })
            .select('pfp_url displayName username socials');
          
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          // Fetch hosted rooms
          const rooms = await Room.find({ host: user._id, status:'ended' })
            .select('roomId name description topics status startTime')
            .sort({ startTime: -1 })
            .lean();

          // Get participant counts for each room
          let totalAudienceEngaged = 0;
          let maxAudienceEngaged = {
            roomId: '',
            name: '',
            startTime: null as Date | null,
            participantCount: 0
          };

          const roomsWithParticipants = await Promise.all(
            rooms.map(async (room: any) => {
              // Count unique participants by distinct userId
              const uniqueParticipants = await RoomParticipant.distinct('userId', { 
                roomId: room._id 
              });
              const participantCount = uniqueParticipants.length;
              
              // Add to total audience
              totalAudienceEngaged += participantCount;
              
              // Check if this room has the max participants
              if (participantCount > maxAudienceEngaged.participantCount) {
                maxAudienceEngaged = {
                  roomId: room.roomId,
                  name: room.name,
                  startTime: room.startTime,
                  participantCount
                };
              }
              
              return {
                ...room,
                participantCount
              };
            })
          );

          return successResponse({ 
            user: {
              pfp_url: user.pfp_url,
              displayName: user.displayName,
              username: user.username,
              socials: user.socials
            }, 
            rooms: roomsWithParticipants,
            totalAudienceEngaged,
            maxAudienceEngaged
          });
        } catch (error) {
          console.error('Error fetching user by username:', error);
          set.status = 500;
          return errorResponse('Failed to fetch user');
        }
      }, {
        params: t.Object({
          username: t.String({ description: 'Username of the user' })
        }),
        response: {
          200: GetUserProfileByUsernameResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Users'],
          summary: 'Get User Profile by Username',
          description: `
Retrieves a user's public profile and their hosted room history.

**Returns:**
- User profile (display name, username, profile picture, socials)
- List of ended rooms they hosted with participant counts
- Total audience engaged across all rooms
- Room with highest engagement

**Use Case:**
Public profile pages, creator statistics.

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      // Handle current user creation/retrieval with Neynar API
      .post('/handle', async ({ headers, set }) => {
        try {
          const fid = headers['x-user-fid'] as string;

          if (!fid) {
            set.status = 500;
            return errorResponse('Authentication middleware did not provide user FID');
          }

          let user = await User.findOne({ fid: parseInt(fid) });
          
          if (!user) {
            const neynarApiKey = config.neynarApiKey;
            if (!neynarApiKey) {
              set.status = 500;
              return errorResponse('Neynar API key not configured');
            }

            const res = await fetch(
              `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
              {
                headers: {
                  "x-api-key": neynarApiKey,
                },
              }
            );

            if (!res.ok) {
              set.status = res.status;
              return errorResponse('Error fetching user from external API');
            }

            const jsonRes = await res.json();
            const neynarRes = jsonRes.users?.[0];

            if (!neynarRes) {
              set.status = 404;
              return errorResponse('User not found in external API');
            }

            console.log("Neynar response:", neynarRes);

            // Extract socials from verified_accounts
            const socials: Record<string, string> = {};
            if (neynarRes?.verified_accounts && Array.isArray(neynarRes.verified_accounts)) {
              neynarRes.verified_accounts.forEach((account: any) => {
                if (account.platform && account.username) {
                  socials[account.platform] = account.username;
                }
              });
            }

            user = await User.create({
              fid: parseInt(fid),
              username: neynarRes?.username || '',
              displayName: neynarRes?.display_name || '',
              pfp_url: neynarRes?.pfp_url || '',
              wallet: neynarRes?.verified_addresses?.primary?.eth_address || neynarRes?.custody_address || '',
              socials: socials
            });
          }

          console.log("Handled user:", user);

          return successResponse({ user }, 'User handled successfully');
        } catch (error) {
          console.error('Error handling user:', error);
          set.status = 500;
          return errorResponse(
            'Internal server error',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        response: {
          200: HandleUserResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Users'],
          summary: 'Handle User Login',
          description: `
Creates or retrieves the authenticated user's profile.

**Behavior:**
1. If user exists in database → returns existing user
2. If user doesn't exist → fetches from Neynar API and creates

**Data Fetched from Neynar:**
- Username, display name, profile picture
- Primary wallet address
- Verified social accounts

**Use Case:**
Called during login/authentication flow to ensure user exists in the system.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Update user topics
      .patch('/topics', async ({ headers, body, set }) => {
        try {
          const fid = headers['x-user-fid'] as string;

          if (!fid) {
            set.status = 500;
            return errorResponse('Authentication middleware did not provide user FID');
          }

          const { topics } = body;

          if (!Array.isArray(topics)) {
            set.status = 400;
            return errorResponse('Missing topics array');
          }

          const user = await User.findOneAndUpdate(
            { fid: parseInt(fid) },
            { topics },
            { 
              new: true, 
              select: 'fid username displayName pfp_url wallet topics socials' 
            }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ user }, 'User topics updated successfully');
        } catch (error) {
          console.error('Error updating user topics:', error);
          set.status = 500;
          return errorResponse(
            'Failed to update user topics',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        body: UpdateUserTopicsRequestSchema,
        response: {
          200: UpdateUserResponseSchema,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Users'],
          summary: 'Update User Topics',
          description: `
Updates the authenticated user's interest topics.

**Topics:**
An array of topic tags the user is interested in. Used for:
- Content recommendations
- Room discovery
- Matching with relevant content

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })

      // Update user profile and data
      .patch('/update', async ({ headers, query, body, set }) => {
        try {
          const fid = headers['x-user-fid'] as string;

          if (!fid) {
            set.status = 400;
            return errorResponse('Missing x-user-fid header');
          }

          // Handle refetch profile data case
          if (query.query === 'profile') {
            const neynarApiKey = config.neynarApiKey;
            if (!neynarApiKey) {
              set.status = 500;
              return errorResponse('Neynar API key not configured');
            }

            // Fetch latest user data from Neynar
            const res = await fetch(
              `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
              {
                headers: {
                  "x-api-key": neynarApiKey,
                },
              }
            );

            if (!res.ok) {
              set.status = res.status;
              return errorResponse('Error fetching user from external API');
            }

            const jsonRes = await res.json();
            const neynarRes = jsonRes.users?.[0];

            if (!neynarRes) {
              set.status = 404;
              return errorResponse('User not found in Neynar');
            }

            // Find existing user to preserve wallet
            const existingUser = await User.findOne({ fid: parseInt(fid) });
            if (!existingUser) {
              set.status = 404;
              return errorResponse('User not found');
            }

            // Extract socials from verified_accounts
            const socials: Record<string, string> = {};
            if (neynarRes?.verified_accounts && Array.isArray(neynarRes.verified_accounts)) {
              neynarRes.verified_accounts.forEach((account: any) => {
                if (account.platform && account.username) {
                  socials[account.platform] = account.username;
                }
              });
            }

            // Update user with latest data from Neynar, but preserve wallet
            const user = await User.findOneAndUpdate(
              { fid: parseInt(fid) },
              { 
                username: neynarRes.username,
                displayName: neynarRes.display_name,
                pfp_url: neynarRes.pfp_url,
                socials: socials
              },
              { new: true, select: 'fid username displayName pfp_url wallet topics socials' }
            );

            return successResponse({ user }, 'Profile refreshed successfully');
          }

          // Handle regular update for topics and/or token
          const topics = body?.topics;
          const token = body?.token;

          console.log(`[User Update] Starting update for FID: ${fid}`);
          console.log(`[User Update] Request body:`, { 
            topicsProvided: topics !== undefined, 
            topicsLength: Array.isArray(topics) ? topics.length : 'not array',
            tokenProvided: token !== undefined,
            tokenLength: typeof token === 'string' ? token.length : 'not string'
          });

          // Create an update object with only the fields that were provided
          var updateObj: any = {};

          // Add topics to update if provided and valid
          if (topics !== undefined) {
            if (!Array.isArray(topics)) {
              console.log(`[User Update] Error: Topics is not an array for FID: ${fid}`, typeof topics);
              set.status = 400;
              return errorResponse('Topics must be an array');
            }
            updateObj.topics = topics;
            console.log(`[User Update] Added topics to update object for FID: ${fid}`, topics);
          }

          // Add token to update if provided
          if (token !== undefined) {
            updateObj.token = token;
            console.log(`[User Update] Added token to update object for FID: ${fid}`, token ? '[TOKEN_PROVIDED]' : '[EMPTY_TOKEN]');
          }

          // If no valid fields to update, return an error
          if (Object.keys(updateObj).length === 0) {
            console.log(`[User Update] Error: No valid fields to update for FID: ${fid}`);
            set.status = 400;
            return errorResponse('No valid fields to update');
          }

          console.log(`[User Update] Update object prepared for FID: ${fid}`, {
            fieldsToUpdate: Object.keys(updateObj),
            updateObjKeys: Object.keys(updateObj)
          });

          const user = await User.findOneAndUpdate(
            { fid: parseInt(fid) },
            updateObj,
            { new: true, select: 'fid username displayName pfp_url wallet topics token socials' }
          );

          if (!user) {
            console.log(`[User Update] Error: User not found for FID: ${fid}`);
            set.status = 404;
            return errorResponse('User not found');
          }

          console.log(`[User Update] Successfully updated user for FID: ${fid}`, {
            updatedFields: Object.keys(updateObj),
            userTopicsCount: user.topics?.length || 0,
            hasToken: !!user.token,
            userId: user._id
          });

          return successResponse({ user }, 'User updated successfully');
        } catch (error: any) {
          console.error('Error updating user profile:', error);
          set.status = 500;
          return errorResponse(
            'Failed to update user profile',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }, {
        query: t.Optional(t.Object({
          query: t.Optional(t.String({ 
            description: 'Set to "profile" to refresh data from Neynar' 
          }))
        })),
        body: t.Optional(t.Object({
          topics: t.Optional(t.Array(t.String(), { description: 'User interest topics' })),
          token: t.Optional(t.String({ description: 'Push notification token' }))
        })),
        response: {
          200: UpdateUserResponseSchema,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Users'],
          summary: 'Update User Profile',
          description: `
Updates user profile data. Supports two modes:

**Mode 1: Refresh from Neynar (query=profile)**
- Fetches latest data from Neynar API
- Updates username, display name, profile picture, socials
- Preserves wallet and local data (topics, token)

**Mode 2: Update Local Data (body fields)**
- \`topics\`: Update interest topics array
- \`token\`: Update push notification token

**Use Cases:**
- Sync profile after Farcaster changes
- Save push notification token for notifications
- Update user interests

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
