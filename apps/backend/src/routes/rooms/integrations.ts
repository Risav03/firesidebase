import { Elysia, t } from 'elysia';
import Room from '../../models/Room';
import User from '../../models/User';
import { RedisRoomParticipantsService } from '../../services/redis';
// @deprecated - 100ms has been replaced with RealtimeKit
// import { HMSAPI } from '../../services/hmsAPI';
import { realtimekitAPI, PRESETS, type PresetName } from '../../services/realtimekitAPI';
import { errorResponse, successResponse } from '../../utils';
import { authMiddleware } from '../../middleware/auth';
import { GetRoomCodesResponseSchema, GetMyCodeResponseSchema, ErrorResponse } from '../../schemas/documentation';

// @deprecated - 100ms room codes are no longer used, use RTK tokens instead
// Documentation schemas for legacy endpoints
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
      // @deprecated - 100ms room codes replaced with RealtimeKit tokens
      // Get all room codes - returns deprecation notice
      .get('/:id/codes', async ({ params, set }) => {
        // This endpoint is deprecated. Use /rtk-token instead.
        return successResponse({ 
          roomCodes: [],
          deprecated: true,
          message: 'Room codes are deprecated. Use /protected/:id/rtk-token endpoint instead for RealtimeKit auth tokens.'
        });
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
          summary: '⚠️ DEPRECATED - Get All Room Codes',
          description: `
**⚠️ DEPRECATED - Use /protected/:id/rtk-token instead**

This endpoint previously returned 100ms room codes. 
The application has migrated to RealtimeKit.

Use the \`/protected/:id/rtk-token\` endpoint to get RealtimeKit auth tokens.
          `
        }
      })
  )

  .guard({
    beforeHandle: authMiddleware
  })
  .group('/protected', (app) =>
    app
      // @deprecated - 100ms room codes replaced with RealtimeKit tokens
      // Get user's specific room code - returns deprecation notice
      .get('/:id/my-code', async ({ headers, params, set }) => {
        // This endpoint is deprecated. Use /rtk-token instead.
        return successResponse({
          role: null,
          code: null,
          roomCode: null,
          deprecated: true,
          message: 'Room codes are deprecated. Use /protected/:id/rtk-token endpoint instead for RealtimeKit auth tokens.'
        });
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
          summary: '⚠️ DEPRECATED - Get My Room Code',
          description: `
**⚠️ DEPRECATED - Use /protected/:id/rtk-token instead**

This endpoint previously returned 100ms room codes.
The application has migrated to RealtimeKit.

Use the \`/protected/:id/rtk-token\` endpoint to get RealtimeKit auth tokens.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      
      // Get RealtimeKit auth token for joining a room
      .get('/:id/rtk-token', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          // Check if RealtimeKit is configured
          if (!realtimekitAPI.isConfigured()) {
            set.status = 503;
            return errorResponse('RealtimeKit is not configured');
          }

          const [room, user] = await Promise.all([
            Room.findById(roomId).populate('host', 'fid displayName pfp_url'),
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

          // Check if room has a RealtimeKit meeting ID
          // If not, we need to create one (this happens during room start)
          if (!room.rtkMeetingId) {
            set.status = 400;
            return errorResponse('Room does not have an active RealtimeKit meeting. Room may not have been started.');
          }

          // Determine user's role/preset
          let preset: PresetName = PRESETS.LISTENER;
          
          // Check if user is the host
          if (room.host && (room.host as any).fid === parseInt(userFid)) {
            preset = PRESETS.HOST;
          } else {
            // Check if user is a participant with a specific role
            const existingParticipant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
            if (existingParticipant) {
              // Map role to preset
              switch (existingParticipant.role) {
                case 'host':
                  preset = PRESETS.HOST;
                  break;
                case 'co-host':
                  preset = PRESETS.COHOST;
                  break;
                case 'speaker':
                  preset = PRESETS.SPEAKER;
                  break;
                default:
                  preset = PRESETS.LISTENER;
              }
            }
          }
          
          // Get auth token from RealtimeKit
          const participantName = user.displayName || user.username || 'Wanderer';
          
          console.log('[RTK Token] Generating token for:', {
            roomId,
            userFid,
            participantName,
            preset,
            meetingId: room.rtkMeetingId,
            hasProfilePic: !!user.pfp_url,
          });
          
          const authToken = await realtimekitAPI.getParticipantToken(
            room.rtkMeetingId,
            participantName,
            preset,
            userFid, // Use FID as custom participant ID for consistency
            user.pfp_url
          );
          
          console.log('[RTK Token] Token generated successfully, length:', authToken?.length);

          return successResponse({
            authToken,
            preset,
            meetingId: room.rtkMeetingId,
            userId: userFid,
          });
        } catch (error) {
          console.error('Error getting RealtimeKit token:', error);
          set.status = 500;
          return errorResponse('Failed to get RealtimeKit token');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              authToken: t.String({ description: 'RealtimeKit auth token for joining' }),
              preset: t.String({ description: 'User preset/role (host, co-host, speaker, listener)' }),
              meetingId: t.String({ description: 'RealtimeKit meeting ID' }),
              userId: t.String({ description: 'User FID used as participant ID' }),
            })
          }),
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
          503: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get RealtimeKit Auth Token',
          description: `
Retrieves a RealtimeKit auth token for the authenticated user to join a room.

**Role Detection:**
1. If user is the room host → host preset
2. If user is a participant with assigned role → matching preset
3. Default → listener preset

**Response:**
- \`authToken\`: Token to pass to initMeeting() on the frontend
- \`preset\`: The user's permission preset
- \`meetingId\`: RealtimeKit meeting ID
- \`userId\`: The user's persistent ID (FID)

**Use Case:**
Use this endpoint to get the auth token needed for RealtimeKit SDK initialization.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      
      // Kick a participant from the RealtimeKit meeting
      .post('/:id/rtk-kick', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;
          const { targetFid, reason } = body;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          if (!realtimekitAPI.isConfigured()) {
            set.status = 503;
            return errorResponse('RealtimeKit is not configured');
          }

          const room = await Room.findById(roomId).populate('host', 'fid');
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (!room.rtkMeetingId) {
            set.status = 400;
            return errorResponse('Room does not have an active RealtimeKit meeting');
          }

          // Check if requesting user is host or co-host
          const isHost = room.host && (room.host as any).fid === parseInt(userFid);
          const requesterParticipant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
          const isCoHost = requesterParticipant?.role === 'co-host';

          if (!isHost && !isCoHost) {
            set.status = 403;
            return errorResponse('Only hosts and co-hosts can kick participants');
          }

          // Find the target participant in RTK
          const participants = await realtimekitAPI.listParticipants(room.rtkMeetingId);
          const targetParticipant = participants.data.find(
            p => p.custom_participant_id === targetFid.toString()
          );

          if (!targetParticipant) {
            set.status = 404;
            return errorResponse('Participant not found in meeting');
          }

          // Kick the participant
          await realtimekitAPI.kickParticipant(room.rtkMeetingId, targetParticipant.id);

          // Remove from Redis
          await RedisRoomParticipantsService.removeParticipant(roomId, targetFid.toString());

          return successResponse({ message: 'Participant kicked successfully' });
        } catch (error) {
          console.error('Error kicking participant:', error);
          set.status = 500;
          return errorResponse('Failed to kick participant');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        body: t.Object({
          targetFid: t.Union([t.String(), t.Number()], { description: 'FID of the participant to kick' }),
          reason: t.Optional(t.String({ description: 'Reason for kicking' }))
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              message: t.String()
            })
          }),
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
          503: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Kick Participant (RTK)',
          description: `
Kicks a participant from the RealtimeKit meeting.

**Authorization:** Only hosts and co-hosts can kick participants.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      
      // Update participant preset/role in RealtimeKit
      .post('/:id/rtk-role', async ({ headers, params, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;
          const { targetFid, newRole } = body;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          if (!realtimekitAPI.isConfigured()) {
            set.status = 503;
            return errorResponse('RealtimeKit is not configured');
          }

          const room = await Room.findById(roomId).populate('host', 'fid');
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          if (!room.rtkMeetingId) {
            set.status = 400;
            return errorResponse('Room does not have an active RealtimeKit meeting');
          }

          // Check if requesting user is host or co-host
          const isHost = room.host && (room.host as any).fid === parseInt(userFid);
          const requesterParticipant = await RedisRoomParticipantsService.getParticipant(roomId, userFid);
          const isCoHost = requesterParticipant?.role === 'co-host';

          if (!isHost && !isCoHost) {
            set.status = 403;
            return errorResponse('Only hosts and co-hosts can change roles');
          }

          // Map role to preset
          let preset: PresetName;
          switch (newRole) {
            case 'host':
              preset = PRESETS.HOST;
              break;
            case 'co-host':
              preset = PRESETS.COHOST;
              break;
            case 'speaker':
              preset = PRESETS.SPEAKER;
              break;
            default:
              preset = PRESETS.LISTENER;
          }

          // Find the target participant in RTK
          const participants = await realtimekitAPI.listParticipants(room.rtkMeetingId);
          const targetParticipant = participants.data.find(
            p => p.custom_participant_id === targetFid.toString()
          );

          if (!targetParticipant) {
            set.status = 404;
            return errorResponse('Participant not found in meeting');
          }

          // Update preset in RealtimeKit
          const updatedParticipant = await realtimekitAPI.updateParticipantPreset(
            room.rtkMeetingId,
            targetParticipant.id,
            preset
          );

          // Update in Redis
          await RedisRoomParticipantsService.updateParticipantRole(roomId, targetFid.toString(), newRole);

          return successResponse({
            message: 'Role updated successfully',
            newRole: newRole,
            newToken: updatedParticipant.data.token, // New token for the participant
          });
        } catch (error) {
          console.error('Error updating participant role:', error);
          set.status = 500;
          return errorResponse('Failed to update participant role');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        body: t.Object({
          targetFid: t.Union([t.String(), t.Number()], { description: 'FID of the participant' }),
          newRole: t.String({ description: 'New role (host, co-host, speaker, listener)' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              message: t.String(),
              newRole: t.String(),
              newToken: t.Optional(t.String({ description: 'New auth token with updated permissions' }))
            })
          }),
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
          503: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Update Participant Role (RTK)',
          description: `
Updates a participant's role/preset in RealtimeKit.

**Authorization:** Only hosts and co-hosts can change roles.

**Returns:** A new auth token that the participant should use to get updated permissions.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      
      // End RealtimeKit meeting
      .post('/:id/rtk-end', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          const roomId = params.id;
          
          if (!userFid) {
            set.status = 401;
            return errorResponse('Authentication required');
          }

          if (!realtimekitAPI.isConfigured()) {
            set.status = 503;
            return errorResponse('RealtimeKit is not configured');
          }

          const room = await Room.findById(roomId).populate('host', 'fid');
          
          if (!room) {
            set.status = 404;
            return errorResponse('Room not found');
          }

          // Check if requesting user is host
          const isHost = room.host && (room.host as any).fid === parseInt(userFid);

          if (!isHost) {
            set.status = 403;
            return errorResponse('Only hosts can end the meeting');
          }

          if (room.rtkMeetingId) {
            await realtimekitAPI.endMeeting(room.rtkMeetingId);
          }

          return successResponse({ message: 'Meeting ended successfully' });
        } catch (error) {
          console.error('Error ending meeting:', error);
          set.status = 500;
          return errorResponse('Failed to end meeting');
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: t.Object({
            success: t.Boolean(),
            data: t.Object({
              message: t.String()
            })
          }),
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
          503: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'End RealtimeKit Meeting',
          description: `
Ends the RealtimeKit meeting, kicking all participants.

**Authorization:** Only hosts can end the meeting.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
