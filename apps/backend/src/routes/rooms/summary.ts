import { Elysia, t } from 'elysia';
import Room from '../../models/Room';
import { RedisRoomStatisticsService } from '../../services/redis';
import { RedisTippingService } from '../../services/redis/tippingDetails';
import { successResponse, errorResponse } from '../../utils';
import AdPayout from '../../models/AdPayout';
import AdAssignment from '../../models/AdAssignment';

/**
 * Response schema for room summary
 */
const RoomSummaryResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Any(),
});

/**
 * Room summary routes for aggregated room statistics
 */
export const summaryRoutes = new Elysia()
  .group('/public', (app) =>
    app
      /**
       * GET /:id/summary
       * Get comprehensive room summary including room details and statistics
       */
      .get(
        '/:id/summary',
        async ({ params, query, set }) => {
          try {
            const { id: roomId } = params;
            const fid = query?.fid as string | undefined;

            // Fetch room details with host information
            const room = await Room.findById(roomId)
              .populate('host', 'fid username displayName pfp_url')
              .lean();

            if (!room) {
              set.status = 404;
              return errorResponse('Room not found');
            }

            // Fetch tip statistics
            const tipStats = await RedisTippingService.getTipStatistics(room.roomId);

            // Fetch peak participant counts
            const peakStats = await RedisRoomStatisticsService.getRoomStatistics(room.roomId);

            // Fetch ads that played in this room
            const completedAssignments = await AdAssignment.find({
              roomId: room._id,
              status: 'completed',
            }).populate('adId').lean();

            const ads = completedAssignments
              .filter((a: any) => a.adId)
              .map((a: any) => ({
                title: a.adId.title,
                imageUrl: a.adId.imageUrl,
                link: a.adId.link || null,
              }));

            // Deduplicate ads by adId (same ad may have been assigned multiple times)
            const uniqueAds = Array.from(
              new Map(ads.map((ad: any) => [ad.imageUrl, ad])).values()
            );

            // Fetch per-user ad earnings if fid is provided
            let userAdEarnings: { fire: number; usd: number } | null = null;
            if (fid) {
              const payout = await AdPayout.findOne({
                roomId: room.roomId,
                status: 'completed',
              }).lean();

              if (payout && payout.distributionDetails) {
                const userDetail = payout.distributionDetails.find(
                  (d: any) => d.fid === fid
                );
                if (userDetail) {
                  const totalFire = payout.fireAmountToDistribute || 0;
                  const totalUsd = payout.usdAmountSwapped || 0;
                  const usdShare = totalFire > 0
                    ? (userDetail.amount / totalFire) * totalUsd
                    : 0;
                  userAdEarnings = {
                    fire: userDetail.amount,
                    usd: usdShare,
                  };
                }
              }
            }

            // Build response
            const summary: any = {
              room: {
                name: room.name,
                host: {
                  name: (room.host as any).displayName || (room.host as any).username,
                  username: (room.host as any).username,
                  image: (room.host as any).pfp_url || '',
                  fid: (room.host as any).fid?.toString() || '',
                },
              },
              statistics: {
                maxSpeakers: peakStats.maxSpeakers,
                maxListeners: peakStats.maxListeners,
                totalTipsUSD: tipStats.totalTipsUSD,
              },
              ads: uniqueAds,
            };

            if (userAdEarnings) {
              summary.userAdEarnings = userAdEarnings;
            }

            return successResponse(summary);
          } catch (error) {
            console.error('Error fetching room summary:', error);
            set.status = 500;
            return errorResponse(
              error instanceof Error ? error.message : 'Failed to fetch room summary'
            );
          }
        },
        {
          params: t.Object({
            id: t.String({ description: 'MongoDB ObjectId of the room' }),
          }),
          response: {
            200: RoomSummaryResponseSchema,
            404: t.Object({
              success: t.Literal(false),
              error: t.String(),
            }),
            500: t.Object({
              success: t.Literal(false),
              error: t.String(),
            }),
          },
          detail: {
            tags: ['Rooms - Summary'],
            summary: 'Get Room Summary',
            description: `
Retrieve comprehensive room summary including:
- Room name
- Host information (name, username, profile picture)
- Peak statistics (max speakers, max listeners)
- Total tips in USD

**Public Endpoint:** No authentication required

**Use Case:** Display room statistics on the room end screen

**Note:** Statistics are tracked in real-time during the room session and may return 0 if Redis data has expired.
            `,
          },
        }
      )
  );
