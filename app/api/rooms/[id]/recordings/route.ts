import { NextRequest, NextResponse } from 'next/server';

interface RecordingAsset {
  id: string;
  thumbnails: any;
  metadata: {
    media_type?: string;
  };
  duration: number;
  path: string;
  status: string;
  created_at: string;
  type: string;
  size: number;
  job_id: string;
  recording_id: string;
  room_id: string;
  session_id: string;
}

interface RecordingAssetsResponse {
  limit: number;
  data: RecordingAsset[];
  last?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    
    if (!roomId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Room ID is required' 
        },
        { status: 400 }
      );
    }

    const managementToken = process.env.HUNDRED_MS_MANAGEMENT_TOKEN;
    
    if (!managementToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'HUNDRED_MS_MANAGEMENT_TOKEN is not configured' 
        },
        { status: 500 }
      );
    }

    // Fetch recording assets from 100ms API
    const response = await fetch(
      `https://api.100ms.live/v2/recording-assets?room_id=${roomId}`,
      {
        headers: {
          'Authorization': `Bearer ${managementToken}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('100ms API error:', response.status, errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch recording assets from 100ms',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const recordingAssets: RecordingAssetsResponse = await response.json();

    // Convert S3 URLs to public URLs
    const convertS3ToPublicUrl = (s3Url: string) => {
      // Convert s3://fireside-100ms/... to https://fireside-100ms.s3.ap-south-1.amazonaws.com/...
      return s3Url.replace('s3://fireside-100ms/', 'https://fireside-100ms.s3.ap-south-1.amazonaws.com/');
    };

    // Segregate recordings by type and convert URLs
    const recordings = recordingAssets.data
      .filter(asset => asset.type === 'room-composite')
      .map(asset => convertS3ToPublicUrl(asset.path));
    
    const chats = recordingAssets.data
      .filter(asset => asset.type === 'chat')
      .map(asset => convertS3ToPublicUrl(asset.path));

    return NextResponse.json({
      success: true,
      roomId: roomId,
      recordings: recordings,
      chats: chats
    });

  } catch (error) {
    console.error('Error fetching recording assets:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
