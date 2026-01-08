import Room from "../models/Room";
import { RedisRoomParticipantsService } from "../services/redis/room-participants";
import { HMSAPI } from "../services/hmsAPI";
import { adRevDistribute } from "../services/ads/adRevDistribute";
import { flushRoomReservationViews } from "../services/ads/viewTracking";

/**
 * Room Cleanup Cron Service
 *
 * Handles automated cleanup of rooms that have no participants for 24+ hours
 * Uses 100ms API as the source of truth for participant information
 */
export class RoomCleanupService {
  /**
   * Delete rooms that have been empty for more than 24 hours
   * Checks participant count from 100ms API and deletes rooms with 0 participants
   * that haven't been updated in the last 24 hours
   */
  static async cleanupEmptyRooms(): Promise<void> {
    try {
      console.log("🧹 Starting room cleanup task...");

      // Get all ongoing rooms that could potentially be empty
      const ongoingRooms = await Room.find({
        status: "ongoing",
        enabled: true,
      }).select("roomId name host updatedAt");

      if (ongoingRooms.length === 0) {
        console.log("📝 No ongoing rooms found to check");
        return;
      }

      console.log(
        `🔍 Checking ${ongoingRooms.length} ongoing rooms for empty participants...`
      );

      const roomsToDelete: string[] = [];
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const hmsAPI = new HMSAPI();

      for (const room of ongoingRooms) {
        try {
          const peersResponse = await hmsAPI.listRoomPeers(room.roomId);
          const participantCount = peersResponse.count;

          if (participantCount === 0 && room.updatedAt < fiveMinsAgo) {
            console.log(
              `🗑️  Room "${room.name}" (${room.roomId}) has been empty for 5+ minutes - marking for deletion`
            );
            roomsToDelete.push(room.roomId);
          }
          else if (participantCount === 0) {
            console.log(
              `⏳ Room "${room.name}" (${room.roomId}) is currently empty but was updated recently - skipping for now`
            );
          }
           else {
            console.log(
              `✅ Room "${room.name}" (${room.roomId}) has ${participantCount} active participants`
            );
          }
        } catch (error) {
          console.error(`❌ Error checking room ${room.roomId}:`, error);
          continue;
        }
      }

      if (roomsToDelete.length > 0) {
        console.log(`🗑️  Deleting ${roomsToDelete.length} empty rooms...`);

        for (const roomId of roomsToDelete) {
          try {
            await hmsAPI.endRoom(
              roomId,
              "Room automatically ended due to inactivity"
            );
          } catch (err) {
            console.error(`❌ Error ending room ${roomId} via 100ms API:`, err);
          }
          try {
            const updatedRoom = await Room.findOneAndUpdate(
              { roomId },
              {
                status: "ended",
                enabled: false,
                ended_at: new Date(),
                endTime: new Date(),
              },
              { new: true, select: "_id adsEnabled roomId" }
            );

            await RedisRoomParticipantsService.deleteRoomParticipants(roomId);

            let viewsFlushed = false;
            if (updatedRoom?._id) {
              try {
                await flushRoomReservationViews(updatedRoom._id.toString());
                viewsFlushed = true;
              } catch (viewErr) {
                console.error(
                  `⚠️ Failed to flush ad views for room ${roomId}:`,
                  viewErr
                );
              }
            }

            if (updatedRoom && updatedRoom.adsEnabled !== false) {
              if (!viewsFlushed) {
                console.warn(
                  `⚠️ Skipping ad payout for room ${roomId} because views were not flushed`
                );
              } else {
              try {
                await adRevDistribute({ roomId: updatedRoom._id.toString() });
                console.log(
                  `🎯 Ad payout triggered for cleaned up room: ${updatedRoom._id.toString()}`
                );
              } catch (payoutErr) {
                console.error(
                  `⚠️ Failed to trigger ad payout for room ${roomId}:`,
                  payoutErr
                );
              }
              }
            }

            console.log(`✅ Successfully cleaned up room: ${roomId}`);
          } catch (error) {
            console.error(`❌ Error deleting room from db ${roomId}:`, error);
          }
        }

        console.log(
          `🎉 Room cleanup completed! Deleted ${roomsToDelete.length} empty rooms`
        );
      } else {
        console.log("✨ No empty rooms found to delete");
      }
    } catch (error) {
      console.error("❌ Room cleanup task failed:", error);
    }
  }
}
