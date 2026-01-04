'use client';

import { useState, useEffect } from 'react';
import { useTipEvent, TipEventMessage } from '@/utils/events';
import { fetchRoomTips } from '@/utils/serverActions';
import sdk from '@farcaster/miniapp-sdk';
import { RiLoader5Fill } from 'react-icons/ri';
import { CiMoneyBill } from 'react-icons/ci';
import { IoChevronDown, IoChevronUp } from 'react-icons/io5';

interface TipsDisplayProps {
  roomId: string;
}

interface TipStatistics {
  totalTipsUSD: number;
  totalTipsByUsers: number;
  tipsByCurrency: {
    ETH: { count: number; totalUSD: number; totalNative: number };
    USDC: { count: number; totalUSD: number; totalNative: number };
    FIRE: { count: number; totalUSD: number; totalNative: number };
  };
  recentTips: Array<{
    id: string;
    tipper: { username: string; pfp_url: string };
    recipients: Array<{ username?: string; pfp_url?: string; role?: string }>;
    amount: { usd: number; currency: string; native: number };
    timestamp: string;
  }>;
}

export default function TipsDisplay({ roomId }: TipsDisplayProps) {
  const [statistics, setStatistics] = useState<TipStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastTipId, setLastTipId] = useState<string>('');

  const fetchStatistics = async () => {
    try {
      const { token } = await sdk.quickAuth.getToken();
      const response = await fetchRoomTips(roomId, token);
      
      if (response.ok && response.data.success) {
        setStatistics(response.data.data);
        
        // Track the latest tip for notification purposes
        if (response.data.data.recentTips.length > 0) {
          const latestTip = response.data.data.recentTips[0];
          if (latestTip.id !== lastTipId) {
            setLastTipId(latestTip.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tip statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for tip events
  useTipEvent((msg: TipEventMessage) => {
    console.log('Tip received:', msg);
    // Refetch statistics when a new tip is received
    fetchStatistics();
  });

  // Initial fetch
  useEffect(() => {
    fetchStatistics();
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <RiLoader5Fill className="animate-spin text-fireside-green" size={24} />
      </div>
    );
  }

  if (!statistics || statistics.totalTipsByUsers === 0) {
    return null;
  }

  const { totalTipsUSD, totalTipsByUsers, tipsByCurrency, recentTips } = statistics;

  return (
    <div className="w-full mt-4 mb-4">
      <div className="gradient-green-bg border border-fireside-green/30 rounded-lg overflow-hidden">
        {/* Header - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <CiMoneyBill className="text-fireside-green text-2xl" />
            <div className="text-left">
              <h3 className="text-fireside-green font-bold text-lg">Room Tips</h3>
              <p className="text-white/70 text-sm">
                ${totalTipsUSD.toFixed(2)} • {totalTipsByUsers} tip{totalTipsByUsers !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-fireside-green">
            {isExpanded ? <IoChevronUp size={24} /> : <IoChevronDown size={24} />}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-fireside-green/30 p-4 space-y-4">
            {/* Currency Breakdown */}
            <div>
              <h4 className="text-fireside-green font-semibold mb-2">By Currency</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(tipsByCurrency).map(([currency, data]) => {
                  if (data.count === 0) return null;
                  return (
                    <div key={currency} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-1">
                        {currency === 'ETH' && (
                          <img src="/ethereum.svg" alt="ETH" className="w-4 h-4" />
                        )}
                        {currency === 'USDC' && (
                          <img src="/usdc.svg" alt="USDC" className="w-4 h-4" />
                        )}
                        {currency === 'FIRE' && (
                          <img src="/fireside-logo.svg" alt="FIRE" className="w-4 h-4" />
                        )}
                        <span className="text-white font-semibold text-sm">{currency}</span>
                      </div>
                      <p className="text-white/80 text-xs">${data.totalUSD.toFixed(2)}</p>
                      <p className="text-white/60 text-xs">
                        {data.totalNative.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
                      </p>
                      <p className="text-white/50 text-xs">{data.count} tip{data.count !== 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Tips */}
            {recentTips.length > 0 && (
              <div>
                <h4 className="text-fireside-green font-semibold mb-2">Recent Tips</h4>
                <div className="space-y-2">
                  {recentTips.map((tip) => {
                    const recipientDisplay = tip.recipients.length > 0
                      ? tip.recipients
                          .map((r) => r.username || r.role || 'Unknown')
                          .join(', ')
                      : 'Unknown';

                    return (
                      <div
                        key={tip.id}
                        className="bg-white/5 rounded-lg p-3 flex items-start gap-3"
                      >
                        <img
                          src={tip.tipper.pfp_url || '/default-avatar.png'}
                          alt={tip.tipper.username}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">
                            <span className="font-semibold">{tip.tipper.username}</span> tipped{' '}
                            <span className="font-semibold">{recipientDisplay}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-fireside-green font-bold text-sm">
                              ${tip.amount.usd.toFixed(2)}
                            </span>
                            <span className="text-white/60 text-xs">
                              ({tip.amount.native.toFixed(tip.amount.currency === 'USDC' ? 2 : 4)}{' '}
                              {tip.amount.currency})
                            </span>
                          </div>
                          <p className="text-white/50 text-xs mt-1">
                            {new Date(tip.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
