import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth';
import User from '../models/User';
import { errorResponse, successResponse } from '../utils';
import { GetAdsPreferenceResponseSchema, IntroOutroAudioResponseSchema, ErrorResponse } from '../schemas/documentation';
import { s3UploadService } from '../services/s3Upload';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .guard({
    beforeHandle: authMiddleware
  })
  .group('/ads-preference', (app) =>
    app
      .get('/', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const user = await User.findOne({ fid: parseInt(userFid) }).select('autoAdsEnabled');
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ autoAdsEnabled: Boolean((user as any).autoAdsEnabled) });
        } catch (err) {
          console.error('[profile] failed to load ads preference', err);
          set.status = 500;
          return errorResponse('Failed to load ads preference');
        }
      }, {
        response: {
          200: GetAdsPreferenceResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Get Ads Preference',
          description: `
Retrieves the user's ads preference setting.

**Returns:**
- \`autoAdsEnabled\`: Boolean indicating if ads are automatically enabled for new rooms

**Use Case:**
Check user's default ads setting before creating a room.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      .put('/', async ({ headers, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const { autoAdsEnabled } = body as { autoAdsEnabled: boolean };
          if (typeof autoAdsEnabled !== 'boolean') {
            set.status = 400;
            return errorResponse('autoAdsEnabled must be a boolean');
          }

          const user = await User.findOneAndUpdate(
            { fid: parseInt(userFid) },
            { autoAdsEnabled },
            { new: true, select: 'autoAdsEnabled' }
          );

          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({ autoAdsEnabled: user.autoAdsEnabled });
        } catch (err) {
          console.error('[profile] failed to update ads preference', err);
          set.status = 500;
          return errorResponse('Failed to update ads preference');
        }
      }, {
        body: t.Object({
          autoAdsEnabled: t.Boolean({ description: 'Whether to auto-enable ads for new rooms' })
        }),
        response: {
          200: GetAdsPreferenceResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Update Ads Preference',
          description: `
Updates the user's default ads preference for new rooms.

**Setting:**
- \`autoAdsEnabled: true\`: New rooms will have ads enabled by default
- \`autoAdsEnabled: false\`: New rooms will have ads disabled by default

**Impact:**
When creating a room without specifying \`adsEnabled\`, this preference is used.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  )
  .group('/intro-outro', (app) =>
    app
      .get('/', async ({ headers, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const user = await User.findOne({ fid: parseInt(userFid) }).select('introAudioUrl outroAudioUrl');
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          return successResponse({
            introAudioUrl: (user as any).introAudioUrl || null,
            outroAudioUrl: (user as any).outroAudioUrl || null
          });
        } catch (err) {
          console.error('[profile] failed to load intro/outro audio', err);
          set.status = 500;
          return errorResponse('Failed to load intro/outro audio');
        }
      }, {
        response: {
          200: IntroOutroAudioResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Get Intro/Outro Audio',
          description: `
Retrieves the current user's intro and outro audio URLs (null if not set).

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      .post('/', async ({ headers, body, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const formData = body as any;
          const kindRaw = (formData?.kind as string || '').toLowerCase();
          const file = formData?.file as File;

          if (kindRaw !== 'intro' && kindRaw !== 'outro') {
            set.status = 400;
            return errorResponse("kind must be 'intro' or 'outro'");
          }
          const kind = kindRaw as 'intro' | 'outro';

          if (!file || !(file as any).type) {
            set.status = 400;
            return errorResponse('Audio file is required');
          }
          if (!(file as any).type.startsWith('audio/')) {
            set.status = 400;
            return errorResponse('File must be an audio file');
          }
          if (typeof (file as any).size === 'number' && (file as any).size > MAX_AUDIO_BYTES) {
            set.status = 400;
            return errorResponse('Audio file must be 10 MB or smaller');
          }

          let newUrl: string;
          try {
            newUrl = await s3UploadService.uploadUserAudio(file, String(user._id), kind);
          } catch (uploadError) {
            console.error('S3 audio upload error:', uploadError);
            set.status = 500;
            return errorResponse('Failed to upload audio');
          }

          const field = kind === 'intro' ? 'introAudioUrl' : 'outroAudioUrl';
          const previousUrl: string | undefined = (user as any)[field];

          (user as any)[field] = newUrl;
          await user.save();

          if (previousUrl && previousUrl !== newUrl) {
            s3UploadService.deleteObjectByUrl(previousUrl).catch((err) => {
              console.warn('Failed to delete previous audio object', err);
            });
          }

          return successResponse({
            introAudioUrl: (user as any).introAudioUrl || null,
            outroAudioUrl: (user as any).outroAudioUrl || null
          });
        } catch (err) {
          console.error('[profile] failed to upload intro/outro audio', err);
          set.status = 500;
          return errorResponse('Failed to upload intro/outro audio');
        }
      }, {
        type: 'formdata',
        response: {
          200: IntroOutroAudioResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Upload Intro/Outro Audio',
          description: `
Uploads a new intro or outro audio file for the authenticated user.

**Form Data Fields:**
- \`kind\`: 'intro' or 'outro' (required)
- \`file\`: Audio file (required, max 10 MB, must start with audio/)

**Storage:** S3 under \`intro-outro/<user._id>/\`. Replaces any previous file of the same kind.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
      .delete('/:kind', async ({ headers, params, set }) => {
        try {
          const userFid = headers['x-user-fid'] as string;
          if (!userFid) {
            set.status = 401;
            return errorResponse('User authentication required');
          }

          const kindRaw = (params.kind || '').toLowerCase();
          if (kindRaw !== 'intro' && kindRaw !== 'outro') {
            set.status = 400;
            return errorResponse("kind must be 'intro' or 'outro'");
          }
          const kind = kindRaw as 'intro' | 'outro';

          const user = await User.findOne({ fid: parseInt(userFid) });
          if (!user) {
            set.status = 404;
            return errorResponse('User not found');
          }

          const field = kind === 'intro' ? 'introAudioUrl' : 'outroAudioUrl';
          const previousUrl: string | undefined = (user as any)[field];

          (user as any)[field] = undefined;
          await user.save();

          if (previousUrl) {
            s3UploadService.deleteObjectByUrl(previousUrl).catch((err) => {
              console.warn('Failed to delete audio object', err);
            });
          }

          return successResponse({
            introAudioUrl: (user as any).introAudioUrl || null,
            outroAudioUrl: (user as any).outroAudioUrl || null
          });
        } catch (err) {
          console.error('[profile] failed to delete intro/outro audio', err);
          set.status = 500;
          return errorResponse('Failed to delete intro/outro audio');
        }
      }, {
        params: t.Object({
          kind: t.String({ description: "'intro' or 'outro'" })
        }),
        response: {
          200: IntroOutroAudioResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse
        },
        detail: {
          tags: ['Profile'],
          summary: 'Delete Intro/Outro Audio',
          description: `
Removes the user's intro or outro audio. Best-effort S3 object deletion.

**Authentication Required:** Yes (Farcaster JWT)
          `,
          security: [{ bearerAuth: [] }]
        }
      })
  );
