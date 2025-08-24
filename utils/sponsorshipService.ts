import Sponsorship from '@/utils/schemas/Sponsorship';
import { connectToDB } from '@/utils/db';

export interface SponsorshipService {
  updateExpiredSponsorships(): Promise<number>;
  
  getApprovedQueue(roomId: string): Promise<any[]>;
  
  activateNextSponsorship(roomId: string): Promise<any | null>;
  
  processQueue(roomId: string): Promise<any | null>;
}

export class SponsorshipServiceImpl implements SponsorshipService {
  
  async updateExpiredSponsorships(): Promise<number> {
    await connectToDB();
    
    const now = new Date();
    
    const result = await Sponsorship.updateMany(
      {
        status: 'active',
        endTime: { $lte: now }
      },
      {
        status: 'completed'
      }
    );
    
    return result.modifiedCount;
  }
  
  async getApprovedQueue(roomId: string): Promise<any[]> {
    await connectToDB();
    
    const approvedSponsorships = await Sponsorship.find({
      roomId,
      status: 'approved'
    })
    .populate('sponsorId', 'fid username displayName pfp_url')
    .sort({ approvedAt: 1 });
    
    return approvedSponsorships;
  }
  
  async activateNextSponsorship(roomId: string): Promise<any | null> {
    await connectToDB();
    
    const now = new Date();
    const activeSponsorship = await Sponsorship.findOne({
      roomId,
      status: 'active',
      startTime: { $lte: now },
      endTime: { $gt: now }
    });
    
    if (activeSponsorship) {
      return null;
    }
    
    const nextSponsorship = await Sponsorship.findOne({
      roomId,
      status: 'approved'
    }).sort({ approvedAt: 1 });
    
    if (!nextSponsorship) {
      return null;
    }
    
    nextSponsorship.status = 'active';
    nextSponsorship.startTime = now;
    nextSponsorship.endTime = new Date(now.getTime() + (nextSponsorship.displayDuration * 1000));
    
    await nextSponsorship.save();
    await nextSponsorship.populate('sponsorId', 'fid username displayName pfp_url');
    
    return nextSponsorship;
  }
  
  async processQueue(roomId: string): Promise<any | null> {
    await connectToDB();
    
    const now = new Date();
    
    const completedResult = await Sponsorship.updateMany({
      roomId,
      status: 'active',
      endTime: { $lte: now }
    }, {
      status: 'completed'
    });
    
    if (completedResult.modifiedCount > 0) {
      console.log(`Completed ${completedResult.modifiedCount} expired sponsorships for room ${roomId}`);
    }
    
    const activated = await this.activateNextSponsorship(roomId);
    
    if (activated) {
      console.log(`Activated sponsorship ${activated._id} for room ${roomId}`);
    }
    
    return activated;
  }
}

export const sponsorshipService = new SponsorshipServiceImpl();