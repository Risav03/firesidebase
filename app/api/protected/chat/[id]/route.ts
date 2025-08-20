import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import User from '@/utils/schemas/User';
import { RedisChatService } from '@/utils/redisServices';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const messages = await RedisChatService.getRoomMessages(params.id, limit, offset);
    const messageCount = await RedisChatService.getRoomMessageCount(params.id);

    return NextResponse.json({
      success: true,
      messages,
      totalCount: messageCount,
      hasMore: offset + limit < messageCount
    });

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { message, userFid } = body;

    if (!message || !userFid) {
      return NextResponse.json(
        { success: false, error: 'Message and userFid are required' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 500 characters)' },
        { status: 400 }
      );
    }

    await connectToDB();
    
    const user = await User.findOne({ fid: userFid });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const chatMessage = await RedisChatService.storeMessage(params.id, user, message);

    return NextResponse.json({
      success: true,
      message: chatMessage
    });

  } catch (error) {
    console.error('Error storing chat message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store message' },
      { status: 500 }
    );
  }
}
