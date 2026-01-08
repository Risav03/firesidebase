import { Elysia, t } from 'elysia';
import Room from '../../models/Room';
import User from '../../models/User';
import { RedisRoomParticipantsService } from '../../services/redis';
import { HMSAPI } from '../../services/hmsAPI';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { GetRoomCodesResponseSchema, GetMyCodeResponseSchema, ErrorResponse } from '../../schemas/documentation';

// Documentation schemas
const RoomCodeSchema = t.Object({
  id: t.String({ description: 'Room code ID' }),
  code: t.String({ description: 'The room code for joining' }),
  role: t.String({ description: 'Role this code grants (host, co-host, speaker, listener)' }),
  room_id: t.String({ description: '100ms room ID' }),
  created_at: t.String({ description: 'ISO timestamp of code creation' }),
  updated_at: t.String({ description: 'ISO timestamp of last update' })
});

export const integrationRoutes = new Elysia()
  .group('/public', (app) =>
    app
      // Get all room codes
      .get('/:id/codes', async ({ params, set }) => {
        try {
          const room = await Room.findById(params.id);
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }
          
          const hmsAPI = new HMSAPI();
          const roomCodes = await hmsAPI.getRoomCodes(room.roomId);
          
          return successResponse({ roomCodes: roomCodes.data });
        } catch (error) {
          console.error('Error fetching room codes:', error);
          set.status = 500;
          return errorResponse('Failed to fetch room codes');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetRoomCodesResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get All Room Codes',
          description: `
Retrieves all 100ms room codes for a room.

**Room Codes:**
Each room has multiple codes, one for each role:
- \`host\`: Full control over the room
- \`co-host\`: Can moderate and manage participants
- \`speaker\`: Can speak in the room
- \`listener\`: Can only listen

**Use Case:**
Use this endpoint to get all codes when you need to display options or manage code distribution.

**Note:** This is a public endpoint. For getting a user's specific code, use the /my-code endpoint.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      // Get user's specific room code based on their role (PROTECTED)
      .get('/:id/my-code', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          const [room, user] = await Promise.all([
            Room.findById(roomId).populate('host', 'fid'),
            User.findOne({ fid: parseInt(userFid) })
          ]);
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          // Determine user's role in the room
          let role = 'listener';
          
          // Check if user is the host
          if (room.host && (room.host as any).fid === parseInt(userFid)) {
            role = 'host';
          } else {
            // Check if user is a participant with a specific role
            const existingParticipant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
            if (existingParticipant) {
              role = existingParticipant.role;
            }
          }
          
          // Get room codes from HMS API
          const hmsAPI = new HMSAPI();
          const roomCodes = await hmsAPI.getRoomCodes(room.roomId);
          
          // Find the appropriate code for the user's role
          const userCode = roomCodes.data.find(code => code.role === role);
          
          if (!userCode) {
            set.status = 404;
            return errorResponse(`No room code found for role: ${role}`);
          }

          return successResponse({
            role: role,
            code: userCode.code,
            roomCode: userCode
          });
        } catch (error) {
          console.error('Error fetching user room code:', error);
          set.status = 500;
          return errorResponse('Failed to fetch user room code');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetMyCodeResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get My Room Code',
          description: `
Retrieves the appropriate 100ms room code for the authenticated user based on their role.

**Role Detection:**
1. If user is the room host → returns host code
2. If user is a participant → returns code matching their role
3. Default → returns listener code

**Response:**
- \`role\`: The detected role for the user
- \`code\`: The room code string to use for joining
- \`roomCode\`: Full room code object with metadata

**Use Case:**
Use this endpoint when a user needs to join the 100ms room. The code determines their permissions in the audio session.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
