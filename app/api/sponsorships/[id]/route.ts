import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Sponsorship from '@/utils/schemas/Sponsorship';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();
    
    const { id } = params;
    
    const sponsorship = await Sponsorship.findById(id)
      .populate('roomId', 'name host status sponsorshipEnabled')
      .populate('sponsorId', 'fid username displayName pfp_url');
    
    if (!sponsorship) {
      return NextResponse.json(
        { success: false, error: 'Sponsorship not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      sponsorship
    });
    
  } catch (error) {
    console.error('Error fetching sponsorship:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sponsorship',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();
    
    const { id } = params;
    const body = await request.json();
    const { action, hostId, hostNotes } = body;
    
    const sponsorship = await Sponsorship.findById(id).populate('roomId');
    
    if (!sponsorship) {
      return NextResponse.json(
        { success: false, error: 'Sponsorship not found' },
        { status: 404 }
      );
    }
    
    if ((action === 'approve' || action === 'reject') && hostId) {
      if (sponsorship.roomId.host.toString() !== hostId) {
        return NextResponse.json(
          { success: false, error: 'Only room host can approve/reject sponsorships' },
          { status: 403 }
        );
      }
    }
    
    switch (action) {
      case 'approve':
        if (sponsorship.status !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'Only pending sponsorships can be approved' },
            { status: 400 }
          );
        }
        
        sponsorship.status = 'approved';
        sponsorship.approvedAt = new Date();
        if (hostNotes) sponsorship.hostNotes = hostNotes;
        
        break;
        
      case 'reject':
        if (sponsorship.status !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'Only pending sponsorships can be rejected' },
            { status: 400 }
          );
        }
        
        sponsorship.status = 'rejected';
        sponsorship.rejectedAt = new Date();
        if (hostNotes) sponsorship.hostNotes = hostNotes;
        
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Valid actions are: approve, reject' },
          { status: 400 }
        );
    }
    
    await sponsorship.save();
    
    // Populate for response
    await sponsorship.populate('roomId', 'name host status sponsorshipEnabled');
    await sponsorship.populate('sponsorId', 'fid username displayName pfp_url');
    
    return NextResponse.json({
      success: true,
      sponsorship,
      message: `Sponsorship ${action}d successfully`
    });
    
  } catch (error) {
    console.error('Error updating sponsorship:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sponsorship',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete sponsorship (only if pending or rejected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDB();
    
    const { id } = params;
    
    const sponsorship = await Sponsorship.findById(id);
    
    if (!sponsorship) {
      return NextResponse.json(
        { success: false, error: 'Sponsorship not found' },
        { status: 404 }
      );
    }
    
    // Only allow deletion of pending or rejected sponsorships
    if (!['pending', 'rejected'].includes(sponsorship.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete approved, active, or completed sponsorships' },
        { status: 400 }
      );
    }
    
    await Sponsorship.findByIdAndDelete(id);
    
    return NextResponse.json({
      success: true,
      message: 'Sponsorship deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting sponsorship:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete sponsorship',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
