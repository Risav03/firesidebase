import { ethers } from "ethers";
import { Types } from "mongoose";
import config from "../../config";
import connectDB from "../../config/database";
import Reward from "../../models/Reward";
import User from "../../models/User";
import Room from "../../models/Room";
import RoomParticipant from "../../models/RoomParticipant";
import { erc20Abi } from "../../utils/contracts/erc20abi";
import { contractAdds, BASE_CHAIN_ID } from "../../utils/contracts/contractAdds";
import { getCachedTokenPrice, calculateTokenAmount } from "../../utils/token-price";
import { RedisUtils } from "../redis/redis-utils";

export interface DailyLoginEligibility {
  eligible: boolean;
  hoursRemaining?: number;
  rewardAmount?: number;
  message?: string;
}

export interface HostingReward {
  baseReward: number;
  milestoneReward: number;
  totalReward: number;
  milestone?: number;
  participantCount: number;
}

export class RewardService {
  private static provider: ethers.JsonRpcProvider;
  private static wallet: ethers.Wallet;

  private static initializeWeb3() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(
        "https://base-mainnet.g.alchemy.com/v2/CA4eh0FjTxMenSW3QxTpJ7D-vWMSHVjq"
      );
    }
    if (!this.wallet) {
      this.wallet = new ethers.Wallet(
        config.rewardWalletPrivateKey,
        this.provider
      );
      console.log('🎁 Reward wallet initialized:', this.wallet.address);
    }
  }

  /**
   * Check if a user is eligible for daily login reward
   */
  static async checkDailyLoginEligibility(userId: string | Types.ObjectId): Promise<DailyLoginEligibility> {
    try {
      await connectDB();

      const user = await User.findById(userId);
      if (!user) {
        return { eligible: false, message: 'User not found' };
      }

      const now = new Date();
      const lastClaimDate = user.lastLoginRewardClaimDate;

      if (!lastClaimDate) {
        return {
          eligible: true,
          rewardAmount: config.dailyLoginRewardAmount,
          message: 'First time claim available'
        };
      }

      const hoursSinceLastClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastClaim >= 24) {
        return {
          eligible: true,
          rewardAmount: config.dailyLoginRewardAmount,
          message: 'Daily reward available'
        };
      }

      const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
      return {
        eligible: false,
        hoursRemaining,
        message: `Next reward available in ${hoursRemaining} hours`
      };
    } catch (error) {
      console.error('❌ Error checking login eligibility:', error);
      throw error;
    }
  }

  /**
   * Claim daily login reward
   */
  static async claimDailyLoginReward(userId: string | Types.ObjectId): Promise<any> {
    const lockKey = `reward:login:${userId}`;
    let lockAcquired = false;

    try {
      await connectDB();

      // Acquire distributed lock to prevent double claims
      lockAcquired = await RedisUtils.acquireLock(lockKey, 30);
      if (!lockAcquired) {
        throw new Error('Another claim is in progress. Please try again.');
      }

      const eligibility = await this.checkDailyLoginEligibility(userId);
      if (!eligibility.eligible) {
        throw new Error(eligibility.message || 'Not eligible for reward');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate token amount based on USD value
      let rewardAmount: number;
      try {
        const tokenPrice = await getCachedTokenPrice(contractAdds.fireToken);
        rewardAmount = calculateTokenAmount(config.dailyLoginRewardUSD, tokenPrice);
        console.log(`💰 Daily login reward: $${config.dailyLoginRewardUSD} = ${rewardAmount} FIRE (price: $${tokenPrice})`);
      } catch (priceError) {
        console.warn('⚠️ Failed to fetch token price, using fallback amount:', priceError);
        rewardAmount = config.dailyLoginRewardAmount;
      }

      // Create pending reward record
      const reward = await Reward.create({
        userId: user._id,
        type: 'daily_login',
        amount: rewardAmount,
        currency: 'FIRE',
        status: 'pending',
        metadata: {},
      });

      // Distribute tokens
      const txHash = await this.transferTokens(
        user.wallet,
        rewardAmount
      );

      // Update reward record
      reward.status = 'completed';
      reward.txHash = txHash;
      reward.claimedAt = new Date();
      reward.distributedAt = new Date();
      await reward.save();

      // Update user record
      user.lastLoginRewardClaimDate = new Date();
      user.rewards = user.rewards || {};
      user.rewards.totalEarned = (user.rewards.totalEarned || 0) + rewardAmount;
      user.rewards.lastRewardAt = new Date();
      await user.save();

      console.log(`✅ Daily login reward distributed to ${user.username}: ${rewardAmount} FIRE (tx: ${txHash})`);

      return {
        success: true,
        reward: {
          id: reward._id,
          amount: reward.amount,
          currency: reward.currency,
          txHash: reward.txHash,
          claimedAt: reward.claimedAt,
        }
      };
    } catch (error) {
      console.error('❌ Error claiming daily login reward:', error);
      throw error;
    } finally {
      if (lockAcquired) {
        await RedisUtils.releaseLock(lockKey);
      }
    }
  }

  /**
   * Calculate hosting rewards based on participant count and room duration
   */
  static async calculateHostingRewards(participantCount: number, durationMinutes: number): Promise<HostingReward> {
    let baseReward: number;
    let milestoneReward: number;
    
    try {
      const tokenPrice = await getCachedTokenPrice(contractAdds.fireToken);
      
      // Calculate base reward from USD value
      baseReward = calculateTokenAmount(config.hostRoomBaseRewardUSD, tokenPrice);
      
      // Find highest milestone achieved from USD-based milestones
      const achievedMilestone = config.participantMilestonesUSD
        .filter(m => participantCount >= m.threshold)
        .sort((a, b) => b.threshold - a.threshold)[0];

      milestoneReward = achievedMilestone 
        ? calculateTokenAmount(achievedMilestone.rewardUSD, tokenPrice)
        : 0;
        
      console.log(`💰 Hosting rewards calculated: Base $${config.hostRoomBaseRewardUSD} = ${baseReward} FIRE, Milestone $${achievedMilestone?.rewardUSD || 0} = ${milestoneReward} FIRE (price: $${tokenPrice})`);
      
      return {
        baseReward,
        milestoneReward,
        totalReward: baseReward + milestoneReward,
        milestone: achievedMilestone?.threshold,
        participantCount,
      };
    } catch (priceError) {
      console.warn('⚠️ Failed to fetch token price, using fallback amounts:', priceError);
      
      // Fallback to old token-based calculation
      baseReward = config.hostRoomBaseRewardAmount;
      
      const achievedMilestone = config.participantMilestones
        .filter(m => participantCount >= m.threshold)
        .sort((a, b) => b.threshold - a.threshold)[0];

      milestoneReward = achievedMilestone?.reward || 0;
      
      return {
        baseReward,
        milestoneReward,
        totalReward: baseReward + milestoneReward,
        milestone: achievedMilestone?.threshold,
        participantCount,
      };
    }
  }

  /**
   * Distribute hosting rewards after room ends
   */
  static async distributeHostingRewards(roomId: string | Types.ObjectId): Promise<any> {
    try {
      await connectDB();

      const room = await Room.findById(roomId).populate('host');
      if (!room) {
        throw new Error('Room not found');
      }

      // Get participant count
      const participants = await RoomParticipant.find({ roomId: room._id });
      const uniqueParticipants = new Set(participants.map(p => p.userId.toString()));
      const participantCount = uniqueParticipants.size;

      // Calculate room duration
      const startTime = new Date(room.startTime);
      const endTime = room.ended_at || new Date();
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      const host = room.host as any;
      if (!host || !host.wallet) {
        throw new Error('Host wallet not found');
      }

      // Check if host already received base hosting reward today
      const now = new Date();
      const lastHostingRewardDate = host.lastHostingRewardDate;
      let eligibleForBaseReward = true;
      
      if (lastHostingRewardDate) {
        const hoursSinceLastReward = (now.getTime() - lastHostingRewardDate.getTime()) / (1000 * 60 * 60);
        eligibleForBaseReward = hoursSinceLastReward >= 24;
      }

      // Calculate rewards based on eligibility
      const rewardCalc = await this.calculateHostingRewards(participantCount, durationMinutes);
      
      // Determine actual reward amount
      let actualRewardAmount: number;
      let rewardType: 'host_room' | 'participant_milestone';
      
      if (eligibleForBaseReward) {
        // First room of the day: give base + milestone rewards
        actualRewardAmount = rewardCalc.totalReward;
        rewardType = 'host_room';
        console.log(`✅ Host eligible for full hosting reward (first room today): ${actualRewardAmount} FIRE`);
      } else {
        // Additional room today: only milestone rewards
        actualRewardAmount = rewardCalc.milestoneReward;
        rewardType = 'participant_milestone';
        console.log(`ℹ️ Host already claimed base reward today, only milestone reward: ${actualRewardAmount} FIRE`);
      }

      if (actualRewardAmount === 0) {
        console.log(`ℹ️ No rewards for room ${roomId} (no milestones or already claimed today)`);
        return { 
          success: true, 
          message: eligibleForBaseReward ? 'No milestones achieved' : 'Only milestone rewards available, none achieved',
          rewardCalc: {
            ...rewardCalc,
            actualReward: 0,
            eligibleForBaseReward
          }
        };
      }

      // Create reward record
      const reward = await Reward.create({
        userId: host._id,
        type: rewardType,
        amount: actualRewardAmount,
        currency: 'FIRE',
        status: 'pending',
        metadata: {
          roomId: room._id,
          participantCount,
          roomDuration: durationMinutes,
          milestone: rewardCalc.milestone,
        },
      });

      // Distribute tokens
      const txHash = await this.transferTokens(host.wallet, actualRewardAmount);

      // Update reward record
      reward.status = 'completed';
      reward.txHash = txHash;
      reward.distributedAt = new Date();
      await reward.save();

      // Update user hosting stats
      host.hostingStats = host.hostingStats || {};
      host.hostingStats.totalRoomsHosted = (host.hostingStats.totalRoomsHosted || 0) + 1;
      host.hostingStats.totalParticipantsEngaged = (host.hostingStats.totalParticipantsEngaged || 0) + participantCount;
      host.hostingStats.lastRoomId = room._id;
      
      host.rewards = host.rewards || {};
      host.rewards.totalEarned = (host.rewards.totalEarned || 0) + actualRewardAmount;
      host.rewards.lastRewardAt = new Date();
      
      // Only update lastHostingRewardDate if base reward was given
      if (eligibleForBaseReward) {
        host.lastHostingRewardDate = new Date();
      }
      
      await host.save();

      console.log(`✅ Hosting rewards distributed to ${host.username}: ${actualRewardAmount} FIRE (tx: ${txHash})`);
      console.log(`   Base: ${eligibleForBaseReward ? rewardCalc.baseReward : 0}, Milestone: ${rewardCalc.milestoneReward}, Participants: ${participantCount}`);
      console.log(`   Reward Type: ${rewardType}, Eligible for base: ${eligibleForBaseReward}`);

      return {
        success: true,
        reward: {
          id: reward._id,
          amount: reward.amount,
          currency: reward.currency,
          txHash: reward.txHash,
          distributedAt: reward.distributedAt,
          breakdown: {
            ...rewardCalc,
            actualReward: actualRewardAmount,
            eligibleForBaseReward,
            rewardType
          },
        }
      };
    } catch (error) {
      console.error('❌ Error distributing hosting rewards:', error);
      
      // Try to mark reward as failed if it exists
      const failedReward = await Reward.findOne({ 
        'metadata.roomId': roomId, 
        type: 'host_room',
        status: 'pending' 
      });
      
      if (failedReward) {
        failedReward.status = 'failed';
        failedReward.errorMessage = error instanceof Error ? error.message : String(error);
        await failedReward.save();
      }
      
      throw error;
    }
  }

  /**
   * Get reward history for a user
   */
  static async getRewardHistory(userId: string | Types.ObjectId, limit: number = 50): Promise<any> {
    try {
      await connectDB();

      const rewards = await Reward.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('metadata.roomId', 'name startTime')
        .lean();

      const user = await User.findById(userId).select('rewards');

      return {
        rewards,
        summary: user?.rewards || { totalEarned: 0, pendingBalance: 0, lastRewardAt: null },
      };
    } catch (error) {
      console.error('❌ Error fetching reward history:', error);
      throw error;
    }
  }

  /**
   * Transfer ERC20 tokens to recipient
   */
  private static async transferTokens(recipientAddress: string, amount: number): Promise<string> {
    try {
      this.initializeWeb3();

      const tokenContract = new ethers.Contract(
        contractAdds.fireToken,
        erc20Abi,
        this.wallet
      );

      // Convert amount to wei (FIRE has 18 decimals)
      const amountWei = ethers.parseUnits(amount.toString(), 18);

      console.log(`💸 Transferring ${amount} FIRE to ${recipientAddress}...`);

      // Execute transfer
      const tx = await tokenContract.transfer(recipientAddress, amountWei);
      console.log('⏳ Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      return receipt.hash;
    } catch (error) {
      console.error('❌ Token transfer failed:', error);
      throw new Error(`Token transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check wallet balance
   */
  static async checkWalletBalance(): Promise<{ balance: string; balanceWei: bigint }> {
    try {
      this.initializeWeb3();

      const tokenContract = new ethers.Contract(
        contractAdds.fireToken,
        erc20Abi,
        this.provider
      );

      const balance = await tokenContract.balanceOf(this.wallet.address);
      const balanceFormatted = ethers.formatUnits(balance, 18);

      return {
        balance: balanceFormatted,
        balanceWei: balance,
      };
    } catch (error) {
      console.error('❌ Error checking wallet balance:', error);
      throw error;
    }
  }
}

export default RewardService;
