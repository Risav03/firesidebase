import { Elysia, t } from "elysia";
import mongoose from "mongoose";
import Room from "../../models/Room";
import User from "../../models/User";
import RoomParticipant from "../../models/RoomParticipant";
import {
  RoomUpdateRequestSchema,
  CreateRoomProtectedRequestSchema,
} from "../../schemas";
import { errorResponse, successResponse, isValidRoomStatus } from "../../utils";
import { authMiddleware } from "../../middleware/auth";
// @deprecated - 100ms has been replaced with RealtimeKit
// import { HMSAPI } from "../../services/hmsAPI";
import { realtimekitAPI } from "../../services/realtimekitAPI";
import { RedisRoomParticipantsService } from "../../services/redis";
import { trackViewerJoin } from "../../services/ads/viewTracking";
import { evaluateAutoAds, forceStopAds } from "../ads";
import "../../config/database";
import { 
  GetRoomsResponseSchema, 
  GetRoomResponseSchema, 
  GetBulkRoomsResponseSchema,
  GetRoomsByTopicsResponseSchema,
  GetRecordingsResponseSchema,
  CreateRoomResponseSchema,
  GetUpcomingRoomsResponseSchema,
  StartRoomResponseSchema,
  UpdateRoomResponseSchema,
  ErrorResponse,
  SimpleSuccessResponseSchema
} from "../../schemas/documentation";

// Common response schemas for documentation
const RoomHostSchema = t.Object({
  fid: t.Number({ description: 'Farcaster ID of the host' }),
  username: t.String({ description: 'Username of the host' }),
  displayName: t.String({ description: 'Display name of the host' }),
  pfp_url: t.String({ description: 'Profile picture URL' })
});

const RoomResponseSchema = t.Object({
  _id: t.String({ description: 'MongoDB ObjectId of the room' }),
  name: t.String({ description: 'Room name' }),
  description: t.Optional(t.String({ description: 'Room description' })),
  host: RoomHostSchema,
  roomId: t.String({ description: '100ms room ID' }),
  status: t.Union([t.Literal('upcoming'), t.Literal('ongoing'), t.Literal('ended')]),
  startTime: t.String({ description: 'ISO date string of room start time' }),
  endTime: t.Optional(t.String({ description: 'ISO date string of room end time' })),
  enabled: t.Boolean({ description: 'Whether the room is enabled' }),
  topics: t.Array(t.String(), { description: 'Array of topic tags' }),
  adsEnabled: t.Optional(t.Boolean({ description: 'Whether ads are enabled for this room' })),
  strength: t.Optional(t.Number({ description: 'Current participant count' }))
});

export const roomManagementRoutes = new Elysia()
  .group("/public", (app) =>
    app
      // Get all enabled rooms
      .get("/", async ({ set }) => {
        try {
          const rooms = await Room.find({ enabled: true })
            .sort({ createdAt: -1 })
            .lean();

          console.log("Fetched rooms:", rooms.length);

          // Extract unique host IDs and fetch their User documents
          const uniqueHostIds = new Set<string>();
          rooms.forEach((room: any) => {
            if (room.host) {
              uniqueHostIds.add(room.host.toString());
            }
          });

          // Fetch User documents to get FIDs
          const hostUsers = await User.find({
            _id: { $in: Array.from(uniqueHostIds) }
          }).lean();

          // Create a map of userId to FID
          const userIdToFidMap: Record<string, number> = {};
          hostUsers.forEach((user: any) => {
            userIdToFidMap[user._id.toString()] = user.fid;
          });

          console.log("User ID to FID map:", userIdToFidMap);

          // Extract unique FIDs
          const uniqueFids = new Set<number>();
          rooms.forEach((room: any) => {
            if (room.host) {
              const fid = userIdToFidMap[room.host.toString()];
              if (fid) {
                uniqueFids.add(fid);
              }
            }
          });

          console.log("UNique FIDS", uniqueFids);

          // Fetch host details from Neynar API
          const fidsArray = Array.from(uniqueFids);
          let hostMap: Record<string, any> = {}; // Map userId to host details
          
          if (fidsArray.length > 0) {
            try {
              const res = await fetch(
                `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsArray.join(',')}`,
                {
                  headers: {
                    "x-api-key": process.env.NEYNAR_API_KEY as string,
                  },
                }
              );
              const data = await res.json();

              console.log("Neynar host details response:", data);
              
              // Create a map of userId to user details
              if (data.users) {
                // Create reverse map: fid to userId
                const fidToUserIdMap: Record<number, string> = {};
                Object.entries(userIdToFidMap).forEach(([userId, fid]) => {
                  fidToUserIdMap[fid] = userId;
                });

                data.users.forEach((user: any) => {
                  const userId = fidToUserIdMap[user.fid];
                  if (userId) {
                    hostMap[userId] = {
                      fid: user.fid,
                      username: user.username,
                      displayName: user.display_name,
                      pfp_url: user.pfp_url,
                    };
                  }
                });
              }
            } catch (error) {
              console.error("Error fetching host details from Neynar:", error);
            }
          }

          console.log("HOST MAP", hostMap);

          // Add strength field and host details to each room
          // Uses RealtimeKit API to get participant count for active rooms
          const roomsWithStrength = await Promise.all(
            rooms.map(async (room: any) => {
              try {
                let strength = 0;
                
                // Only fetch participants if room has an active RTK meeting
                if (room.rtkMeetingId && realtimekitAPI.isConfigured()) {
                  console.log("Fetching participants for RTK meeting:", room.rtkMeetingId);
                  const participantsData = await realtimekitAPI.listParticipants(room.rtkMeetingId);
                  strength = participantsData.data?.length || 0;
                  console.log("RTK participants count:", strength, room.rtkMeetingId);
                }
                
                return {
                  ...room,
                  host: hostMap[room.host.toString()] || null,
                  strength,
                };
              } catch (error) {
                console.error(
                  `Failed to get participants for room ${room.rtkMeetingId}:`,
                  error
                );
                // Return room with zero strength if we can't get the count
                return {
                  ...room,
                  host: hostMap[room.host.toString()] || null,
                  strength: 0,
                };
              }
            })
          );

          console.log("Rooms with strength:", roomsWithStrength);

          return successResponse({ rooms: roomsWithStrength });
        } catch (error) {
          set.status = 500;
          return errorResponse(
            "Failed to fetch rooms",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }, {
        response: {
          200: GetRoomsResponseSchema,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get All Active Rooms',
          description: `
Retrieves all enabled/active rooms with their current participant counts.

**Features:**
- Returns rooms sorted by creation date (newest first)
- Includes host profile information from Farcaster
- Includes real-time participant count (strength) from 100ms
- Only returns rooms where \`enabled: true\`

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get room by ID
      .get("/:id", async ({ params, set }) => {
        try {
          console.log("Fetching room by ID:", params.id);
          const room = await Room.findById(params.id)
            .populate("host", "fid username displayName pfp_url")
            .lean();

          console.log("Room fetched by ID:", room);

          if (!room) {
            set.status = 404;
            return errorResponse("Room not found");
          }

          // Get participants with their user details
          const participantRecords = await RoomParticipant.find({
            roomId: params.id,
          })
            .populate("userId", "fid username displayName pfp_url")
            .lean();

          // Transform participants to include role and joinedAt
          const participants = participantRecords.map((participant) => ({
            ...participant.userId,
            role: participant.role,
            joinedAt: participant.joinedAt,
          }));

          const roomWithParticipants = {
            ...room,
            participants,
          };

          console.log("Fetched room:", roomWithParticipants);

          return successResponse({ room: roomWithParticipants });
        } catch (error) {
          set.status = 500;
          console.log("Error fetching room by ID:", error);
          return errorResponse("Failed to fetch room");
        }
      }, {
        params: t.Object({
          id: t.String({ description: 'MongoDB ObjectId of the room' })
        }),
        response: {
          200: GetRoomResponseSchema,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Room by ID',
          description: `
Retrieves a single room by its MongoDB ObjectId.

**Returns:**
- Full room details including host information
- List of all participants with their roles and join times

**Note:** This is a public endpoint and does not require authentication.
          `
        }
      })

      // Get multiple rooms by IDs
      .post(
        "/bulk",
        async ({ body, set }) => {
          try {
            const { ids } = body;

            if (!Array.isArray(ids) || ids.length === 0) {
              set.status = 400;
              return errorResponse("Room IDs array is required");
            }

            const rooms = await Room.find({
              _id: { $in: ids },
              enabled: true,
            })
              .populate("host", "fid username displayName pfp_url")
              .sort({ createdAt: -1 })
              .lean();

            // Get participants for all rooms
            const roomIds = rooms.map((room: any) => room._id);
            const allParticipantRecords = await RoomParticipant.find({
              roomId: { $in: roomIds },
            })
              .populate("userId", "fid username displayName pfp_url")
              .lean();

            // Group participants by room ID
            const participantsByRoom: Record<string, any[]> =
              allParticipantRecords.reduce(
                (acc: Record<string, any[]>, participant: any) => {
                  const roomId = participant.roomId.toString();
                  if (!acc[roomId]) {
                    acc[roomId] = [];
                  }
                  acc[roomId].push({
                    ...participant.userId,
                    role: participant.role,
                    joinedAt: participant.joinedAt,
                  });
                  return acc;
                },
                {}
              );

            // Add participants to each room
            const roomsWithParticipants = rooms.map((room: any) => ({
              ...room,
              participants: participantsByRoom[room._id.toString()] || [],
            }));

            return successResponse({ rooms: roomsWithParticipants });
          } catch (error) {
            console.error("Error fetching rooms by IDs:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch rooms by IDs",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        },
        {
          body: t.Object({
            ids: t.Array(t.String(), { 
              description: 'Array of MongoDB ObjectIds',
              minItems: 1
            })
          }),
          response: {
            200: GetBulkRoomsResponseSchema,
            400: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get Multiple Rooms by IDs',
            description: `
Retrieves multiple rooms by their MongoDB ObjectIds in a single request.

**Use Case:** Efficient batch fetching when you have a list of room IDs.

**Features:**
- Only returns enabled rooms
- Includes host and participant information for each room
- Results sorted by creation date (newest first)

**Note:** This is a public endpoint and does not require authentication.
            `
          }
        }
      )

      // Get recordings for a room
      // @deprecated - Recordings endpoint disabled (100ms dependency removed)
      // RealtimeKit recording integration pending
      // .get("/:id/recordings", async ({ params, set }) => {
      //   try {
      //     const room = await Room.findOne({ roomId: params.id });
      //     if (!room) {
      //       set.status = 404;
      //       return errorResponse("Room not found");
      //     }
      //     // TODO: Implement RealtimeKit recording API when available
      //     return successResponse({ recordings: [] });
      //   } catch (error) {
      //     console.error("Error fetching recording assets:", error);
      //     set.status = 500;
      //     return errorResponse("Failed to fetch recording assets");
      //   }
      // })

      // Placeholder for recordings endpoint (returns empty until RTK recording is implemented)
      .get("/:id/recordings", async ({ params, set }) => {
        // TODO: Implement RealtimeKit recording API when available
        return successResponse({ recordings: [], message: "Recordings feature pending RealtimeKit integration" });
      }, {
        params: t.Object({
          id: t.String({ description: 'Room ID' })
        }),
        response: {
          200: GetRecordingsResponseSchema,
          500: ErrorResponse
        },
        detail: {
          tags: ['Rooms'],
          summary: 'Get Room Recordings (Pending)',
          description: `
**⚠️ PENDING IMPLEMENTATION**

This endpoint will return recordings once RealtimeKit recording integration is complete.
Currently returns an empty array.
          `
        }
      })

      // Get rooms by topics
      .post(
        "/by-topics",
        async ({ body, set }) => {
          try {
            const { topics } = body;
            if (!Array.isArray(topics) || topics.length === 0) {
              set.status = 400;
              return errorResponse("No topics provided");
            }

            const rooms = await Room.find({
              topics: { $in: topics },
              // enabled: true
            })
              .select(
                "name description host status startTime endTime topics roomId enabled"
              )
              .populate("host", "fid username displayName pfp_url")
              .sort({ createdAt: -1 })
              .limit(10)
              .lean();

            // console.log("Rooms found for topics", topics, rooms);

            return successResponse({ rooms });
          } catch (error) {
            console.error("Error fetching rooms by topics:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch rooms by topics",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        },
        {
          body: t.Object({
            topics: t.Array(t.String(), {
              description: 'Array of topic tags to filter by',
              minItems: 1
            })
          }),
          response: {
            200: GetRoomsByTopicsResponseSchema,
            400: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get Rooms by Topics',
            description: `
Retrieves rooms that match any of the provided topics.

**Features:**
- Filters rooms by topic tags (uses \`$in\` - matches any topic)
- Returns up to 10 rooms per request
- Results sorted by creation date (newest first)

**Use Case:** Content discovery based on user interests.

**Note:** This is a public endpoint and does not require authentication.
            `
          }
        }
      )
  )

  .guard({
    beforeHandle: authMiddleware,
  })
  .group(
    "/protected",
    (app) =>
      app
        // Non-transactional version for standalone MongoDB
        .post(
          "/",
          async ({ headers, body, set }) => {
            let savedRoom: any = null;
            let hmsRoom: any = null;

            try {
              const { name, description, startTime, topics, adsEnabled } = body;
              const userFid = headers["x-user-fid"] as string;

              const hostUser = await User.findOne({ fid: parseInt(userFid) });
              if (!hostUser) {
                set.status = 404;
                return errorResponse("Host user not found");
              }
              const resolvedAdsEnabled =
                typeof adsEnabled === "boolean"
                  ? adsEnabled
                  : Boolean((hostUser as any).autoAdsEnabled);

              // Trim the name off any symbols or digits and append Date.now() to ensure uniqueness
              const trimmedName = name.replace(/[^\w\s]/gi, "").trim();
              const uniqueName = `${trimmedName}-${Date.now()}`;

              const currentTime = new Date();
              const roomStartTime = new Date(startTime);

              let rtkMeetingId = "";

              // Only create RealtimeKit meeting if room is starting now (not scheduled)
              if (currentTime > roomStartTime) {
                // Create RealtimeKit meeting
                if (!realtimekitAPI.isConfigured()) {
                  set.status = 503;
                  return errorResponse("RealtimeKit is not configured. Please set REALTIMEKIT_API_KEY and REALTIMEKIT_ORG_ID.");
                }

                try {
                  const rtkMeeting = await realtimekitAPI.createMeeting(uniqueName);
                  rtkMeetingId = rtkMeeting.data.id;
                  console.log(`[Room Create] Created RealtimeKit meeting: ${rtkMeetingId}`);
                } catch (error) {
                  console.error("Error creating RealtimeKit meeting:", error);
                  set.status = 500;
                  return errorResponse("Failed to create RealtimeKit meeting");
                }
              }

              const room = new Room({
                name,
                description: description || "",
                host: hostUser._id,
                startTime: roomStartTime,
                roomId: "", // Deprecated: 100ms room ID (kept for schema compatibility)
                rtkMeetingId: rtkMeetingId,
                status: currentTime < roomStartTime ? "upcoming" : "ongoing",
                enabled: true,
                topics,
                adsEnabled: resolvedAdsEnabled,
              });

              try {
                savedRoom = await room.save();

                // Create host participant record
                if (savedRoom) {
                  await RoomParticipant.create({
                    roomId: savedRoom._id,
                    userId: hostUser._id,
                    role: "host",
                    joinedAt: new Date(),
                  });
                }
              } catch (error) {
                throw error;
              }

              if (savedRoom) {
                await savedRoom.populate(
                  "host",
                  "fid username displayName pfp_url"
                );
              }

              try {
                if (savedRoom) {
                  const roomId = savedRoom._id.toString();
                  await RedisRoomParticipantsService.addParticipant(
                    roomId,
                    hostUser.toObject(),
                    "host"
                  );
                  await trackViewerJoin(roomId, hostUser.fid.toString());
                  console.log("Host added to Redis participants successfully");
                }
              } catch (redisError) {
                console.error("Failed to add host to Redis:", redisError);
              }

              return successResponse(savedRoom, "Room created successfully");
            } catch (error) {
              console.error("Error creating room:", error);
              set.status = 500;
              return errorResponse(
                "Failed to create room",
                error instanceof Error ? error.message : "Unknown error"
              );
            }
          },
          {
            body: CreateRoomProtectedRequestSchema,
            response: {
              200: CreateRoomResponseSchema,
              404: ErrorResponse,
              500: ErrorResponse
            },
            detail: {
              tags: ['Rooms'],
              summary: 'Create New Room',
              description: `
Creates a new audio room.

**Behavior:**
- If \`startTime\` is in the future, creates an "upcoming" room without 100ms room
- If \`startTime\` is now or past, creates an "ongoing" room with 100ms integration
- Automatically adds the authenticated user as the host
- Tracks the host as a viewer for ad analytics

**Ads Behavior:**
- If \`adsEnabled\` is not provided, uses the host's \`autoAdsEnabled\` preference
- Can be toggled later via room update

**Required Fields:**
- \`name\`: Room name (1-100 characters)
- \`startTime\`: ISO date string
- \`topics\`: Array of topic tags (at least 1)

**Authentication Required:** Yes (Farcaster JWT)
              `,
              security: [{ bearerAuth: [] }]
            }
          }
        )

        // Get upcoming rooms hosted by the current user
        .get("/upcoming", async ({ headers, set }) => {
          try {
            const userFid = headers["x-user-fid"] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse("User authentication required");
            }

            const user = await User.findOne({ fid: parseInt(userFid) });
            if (!user) {
              set.status = 404;
              return errorResponse("User not found");
            }

            console.log(
              `[Upcoming Rooms] Fetching upcoming rooms for user FID: ${userFid}`
            );

            const upcomingRooms = await Room.find({
              host: user._id,
              status: "upcoming",
              enabled: true,
            })
              .sort({ startTime: 1 }) // Sort by start time ascending (earliest first)
              .populate("host", "fid username displayName pfp_url")
              .lean();

            console.log(
              `[Upcoming Rooms] Found ${upcomingRooms.length} upcoming rooms for user FID: ${userFid}`
            );

            return successResponse({ rooms: upcomingRooms });
          } catch (error) {
            console.error("Error fetching upcoming rooms:", error);
            set.status = 500;
            return errorResponse(
              "Failed to fetch upcoming rooms",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }, {
          response: {
            200: GetUpcomingRoomsResponseSchema,
            401: ErrorResponse,
            404: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Get My Upcoming Rooms',
            description: `
Retrieves all upcoming rooms hosted by the authenticated user.

**Features:**
- Only returns rooms with \`status: "upcoming"\` and \`enabled: true\`
- Sorted by start time (earliest first)
- Useful for dashboard/scheduling views

**Authentication Required:** Yes (Farcaster JWT)
            `,
            security: [{ bearerAuth: [] }]
          }
        })

        // Start a room - create HMS room and update room info
        .post("/start/:roomId", async ({ headers, params, set }) => {
          try {
            const userFid = headers["x-user-fid"] as string;

            if (!userFid) {
              set.status = 401;
              return errorResponse("User authentication required");
            }

            const user = await User.findOne({ fid: parseInt(userFid) });
            if (!user) {
              set.status = 404;
              return errorResponse("User not found");
            }

            const room = await Room.findById(params.roomId).populate(
              "host",
              "fid username displayName pfp_url _id"
            );
            if (!room) {
              set.status = 404;
              return errorResponse("Room not found");
            }

            // Check if user is the host
            if (room.host._id.toString() !== user._id.toString()) {
              set.status = 403;
              return errorResponse("Only the room host can start the room");
            }

            // Check if room already has a RealtimeKit meeting ID
            if (room.rtkMeetingId) {
              set.status = 400;
              return errorResponse("Room has already been started");
            }

            // Ensure RealtimeKit is configured
            if (!realtimekitAPI.isConfigured()) {
              set.status = 503;
              return errorResponse("RealtimeKit is not configured. Please set REALTIMEKIT_API_KEY and REALTIMEKIT_ORG_ID.");
            }

            let rtkMeeting: any = null;

            // Trim the name off any symbols or digits and append Date.now() to ensure uniqueness
            const trimmedName = room.name.replace(/[^\w\s]/gi, "").trim();
            const uniqueName = `${trimmedName}-${Date.now()}`;

            // Create RealtimeKit meeting
            try {
              rtkMeeting = await realtimekitAPI.createMeeting(uniqueName);
              console.log(`[Room Start] Created RealtimeKit meeting: ${rtkMeeting.data.id}`);
            } catch (error) {
              console.error("Error creating RealtimeKit meeting:", error);
              set.status = 500;
              return errorResponse("Failed to create RealtimeKit meeting");
            }

            const interested = room.interested || [];

            const tokens = await Promise.all(
              interested.map(async (userId: any) => {
                const user = await User.findById(userId);
                return user?.token;
              })
            );

            // Update the room with RealtimeKit meeting ID and set status to ongoing
            const updatedRoom = await Room.findByIdAndUpdate(
              params.roomId,
              {
                rtkMeetingId: rtkMeeting.data.id,
                status: "ongoing",
              },
              { new: true }
            ).populate("host", "fid username displayName pfp_url");

            console.log(
              `[Room Start] Successfully started room ${params.roomId} with RTK ID: ${rtkMeeting.data.id}`
            );

            const res1 = await fetch(
              "https://api.farcaster.xyz/v1/frame-notifications",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  notificationId: crypto.randomUUID(),
                  title: `Going Live!`,
                  body: `${
                    room?.host.displayName || room?.host.username
                  } has started the room ${updatedRoom?.name}`,
                  targetUrl: `https://firesidebase.vercel.app/call/${room?._id}`,
                  tokens: tokens,
                }),
              }
            ).catch((err) => {
              console.error("FCast notification error:", err);
            });

            const res2 = await fetch(
              "https://api.neynar.com/f/app_host/notify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  notificationId: crypto.randomUUID(),
                  title: `Going Live!`,
                  body: `${
                    room?.host.displayName || room?.host.username
                  } has started the room ${updatedRoom?.name}`,
                  targetUrl: `https://firesidebase.vercel.app/call/${room?._id}`,
                  tokens: tokens,
                }),
              }
            ).catch((err) => {
              console.error("Neynar notification error:", err);
            });

            console.log("FCast notification response:", res1, res2);

            return successResponse(updatedRoom, "Room started successfully");
          } catch (error) {
            console.error("Error starting room:", error);
            set.status = 500;
            return errorResponse(
              "Failed to start room",
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }, {
          params: t.Object({
            roomId: t.String({ description: 'MongoDB ObjectId of the room to start' })
          }),
          response: {
            200: StartRoomResponseSchema,
            400: ErrorResponse,
            401: ErrorResponse,
            403: ErrorResponse,
            404: ErrorResponse,
            500: ErrorResponse
          },
          detail: {
            tags: ['Rooms'],
            summary: 'Start Scheduled Room',
            description: `
Starts a scheduled (upcoming) room by creating the 100ms room and sending notifications.

**Actions Performed:**
1. Creates room in 100ms platform
2. Generates room codes for all roles
3. Updates room status to "ongoing"
4. Sends push notifications to interested users via Farcaster and Neynar

**Prerequisites:**
- Room must be in "upcoming" status
- Room must not have an existing 100ms room ID
- User must be the room host

**Authorization:** Only the room host can start the room.

**Authentication Required:** Yes (Farcaster JWT)
            `,
            security: [{ bearerAuth: [] }]
          }
        })

        // Update room
        .put(
          "/:id",
          async ({ headers, params, body, set }: any) => {
            try {
              const userFid = headers["x-user-fid"] as string;
              const user = await User.findOne({ fid: parseInt(userFid) });

              if (!user) {
                set.status = 404;
                return errorResponse("User not found");
              }

              var room = await Room.findById(params.id);
              if (!room) {
                set.status = 404;
                return errorResponse("Room not found");
              }

              const {
                status,
                endTime,
                participants,
                action,
                interested,
                adsEnabled,
              } = body;

              const updates: any = {};
              let shouldAutoStart = false;
              let shouldAutoStop = false;

              if (interested) {
                var arr = room.interested || [];

                const user = await User.findOne({ fid: interested });
                if (!user) {
                  set.status = 404;
                  return errorResponse("Interested user not found");
                }
                if (arr.includes(user._id)) {
                  return successResponse(room, "Room updated successfully");
                }
                arr.push(user._id);

                room.interested = arr;

                await room.save();

                return successResponse(room, "Room updated successfully");
              }

              if (room.host.toString() !== user._id.toString()) {
                set.status = 403;
                return errorResponse("Only the room host can update the room");
              }

              if (status && isValidRoomStatus(status)) {
                updates.status = status;
              } else if (status) {
                set.status = 400;
                return errorResponse("Invalid room status");
              }

              if (endTime) {
                updates.endTime = new Date(endTime);
              }

              if (
                typeof adsEnabled === "boolean" &&
                adsEnabled !== room.adsEnabled
              ) {
                updates.adsEnabled = adsEnabled;
                shouldAutoStart = adsEnabled;
                shouldAutoStop = !adsEnabled;
              }

              // sponsorship removed

              if (participants && action) {
                if (action === "add") {
                  for (const participantId of participants) {
                    await RoomParticipant.findOneAndUpdate(
                      { roomId: room._id, userId: participantId },
                      {
                        roomId: room._id,
                        userId: participantId,
                        role: "listener",
                        joinedAt: new Date(),
                      },
                      { upsert: true, new: true }
                    );
                  }
                } else if (action === "remove") {
                  await RoomParticipant.deleteMany({
                    roomId: room._id,
                    userId: { $in: participants },
                  });
                } else {
                  set.status = 400;
                  return errorResponse(
                    'Invalid action. Must be "add" or "remove"'
                  );
                }
              }

              const updatedRoom = await Room.findByIdAndUpdate(
                params.id,
                updates,
                {
                  new: true,
                  runValidators: true,
                }
              );

              if (!updatedRoom) {
                set.status = 404;
                return errorResponse("Room not found");
              }

              if (shouldAutoStop) {
                forceStopAds(params.id, "ads_disabled").catch((err) =>
                  console.error("[ads] failed to stop after toggle", err)
                );
              } else if (shouldAutoStart) {
                evaluateAutoAds(params.id).catch((err) =>
                  console.error("[ads] failed to auto-start after toggle", err)
                );
              }

              // Get updated room with participants
              const updatedRoomWithHost = await Room.findById(updatedRoom._id)
                .populate("host", "fid username displayName pfp_url")
                .lean();

              // Get participants with their user details
              const participantRecords = await RoomParticipant.find({
                roomId: updatedRoom._id,
              })
                .populate("userId", "fid username displayName pfp_url")
                .lean();

              // Transform participants to include role and joinedAt
              const roomParticipants = participantRecords.map(
                (participant: any) => ({
                  ...participant.userId,
                  role: participant.role,
                  joinedAt: participant.joinedAt,
                })
              );

              const roomWithParticipants = {
                ...updatedRoomWithHost,
                participants: roomParticipants,
              };

              return successResponse(
                roomWithParticipants,
                "Room updated successfully"
              );
            } catch (error) {
              set.status = 500;
              return errorResponse("Failed to update room");
            }
          },
          {
            body: RoomUpdateRequestSchema,
            params: t.Object({
              id: t.String({ description: 'MongoDB ObjectId of the room' })
            }),
            response: {
              200: UpdateRoomResponseSchema,
              400: ErrorResponse,
              403: ErrorResponse,
              404: ErrorResponse,
              500: ErrorResponse
            },
            detail: {
              tags: ['Rooms'],
              summary: 'Update Room',
              description: `
Updates room properties. Different behaviors based on the update type:

**Interest Registration (Public-ish):**
- Any authenticated user can add themselves as "interested"
- Used for notification subscriptions when room goes live

**Host-Only Updates:**
- \`status\`: Change room status (upcoming/ongoing/ended)
- \`endTime\`: Set room end time
- \`adsEnabled\`: Toggle ads for the room
- \`participants\` + \`action\`: Bulk add/remove participants

**Ads Behavior:**
- Toggling \`adsEnabled\` to \`true\` triggers auto-start evaluation
- Toggling \`adsEnabled\` to \`false\` stops any running ad session

**Authentication Required:** Yes (Farcaster JWT)
              `,
              security: [{ bearerAuth: [] }]
            }
          }
        )
  );
