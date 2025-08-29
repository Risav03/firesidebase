// import { NextRequest, NextResponse } from 'next/server';
// import { connectToDB } from '@/utils/db';
// import Sponsorship from '@/utils/schemas/Sponsorship';

// export async function GET(request: NextRequest) {
//   try {
//     await connectToDB();
    
//     const { searchParams } = new URL(request.url);
//     const roomId = searchParams.get('roomId');
    
//     if (!roomId) {
//       return NextResponse.json(
//         { success: false, error: 'Room ID is required' },
//         { status: 400 }
//       );
//     }
    
//     const now = new Date();
    
//     const activeSponsorship = await Sponsorship.findOne({
//       roomId,
//       status: 'active',
//       startTime: { $lte: now },
//       endTime: { $gt: now }
//     })
//     .populate('sponsorId', 'fid username displayName pfp_url')
//     .populate('roomId', 'name');
    
//     return NextResponse.json({
//       success: true,
//       activeSponsorship
//     });
    
//   } catch (error) {
//     console.error('Error fetching active sponsorship:', error);
//     return NextResponse.json(
//       {
//         success: false,
//         error: 'Failed to fetch active sponsorship',
//         details: error instanceof Error ? error.message : 'Unknown error'
//       },
//       { status: 500 }
//     );
//   }
// }
