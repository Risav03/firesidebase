'use client'

/**
 * UserContextMenuRTK - RealtimeKit version of UserContextMenu
 * 
 * Key changes from 100ms version:
 * - Uses useLocalParticipant() instead of selectLocalPeer
 * - Uses useParticipantActions() for mute/kick
 * - Uses useStageManagement() for stage operations
 * - Uses participant.disableAudio() instead of setRemoteTrackEnabled
 * - Uses participant.kick() instead of removePeer
 * - Uses stage.grantAccess(userIds) for promoting to speaker
 * - Uses stage.kick(userIds) for demoting to listener
 * 
 * Note: Stage APIs use userId (persistent), not id (session)
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRealtimeKit } from '@/utils/providers/realtimekit';
import { 
  useLocalParticipant, 
  useParticipantActions,
  useStageManagement,
  getParticipantRole,
  isHostOrCohost,
  canMuteOthers,
  canKickParticipants,
  type RealtimeKitParticipant 
} from '@/utils/providers/realtimekit-hooks';
import sdk from "@farcaster/miniapp-sdk";
import { updateParticipantRole } from '@/utils/serverActions';
import { Card } from './UI/Card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './UI/drawer';
import { toast } from 'react-toastify';
import { useAccount, useSendCalls } from 'wagmi';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { encodeFunctionData, numberToHex } from 'viem';
import { contractAdds } from '@/utils/contract/contractAdds';
import { firebaseTipsAbi } from '@/utils/contract/abis/firebaseTipsAbi';
import { erc20Abi } from '@/utils/contract/abis/erc20abi';
import { executeTransaction, type TransactionCall } from '@/utils/transactionHelpers';
import { useGlobalContext } from '@/utils/providers/globalContext';
import Image from 'next/image';
import { MdMic, MdMicOff, MdPersonRemove, MdArrowUpward, MdArrowDownward } from 'react-icons/md';

interface UserContextMenuRTKProps {
  peer: RealtimeKitParticipant;
  isVisible: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  onViewProfile?: () => void;
}

export default function UserContextMenuRTK({ peer, isVisible, onClose, onViewProfile }: UserContextMenuRTKProps) {
  const { meeting } = useRealtimeKit();
  const localParticipant = useLocalParticipant(meeting);
  const { muteParticipant, kickParticipant } = useParticipantActions(meeting);
  const { acceptStageRequest, removeFromStage } = useStageManagement(meeting);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Tip drawer state
  const [isTipDrawerOpen, setIsTipDrawerOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<string>('');
  const [isTipping, setIsTipping] = useState(false);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [firePrice, setFirePrice] = useState<number | null>(null);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const FIRE_ADDRESS = '0x9e68E029cBDe7513620Fcb537A44abff88a56186';
  
  const { user } = useGlobalContext();
  const { context } = useMiniKit();
  const { address } = useAccount();
  const { sendCalls, isSuccess, status } = useSendCalls();
  const lastCurrencyRef = useRef<string>('ETH');

  // Permissions
  const canMute = canMuteOthers(meeting);
  const canKick = canKickParticipants(meeting);
  
  // Role checks
  const localRole = localParticipant ? getParticipantRole(localParticipant) : 'listener';
  const peerRole = getParticipantRole(peer);
  const isLocalHostOrCohost = isHostOrCohost(localParticipant as any);
  const isLocalUser = peer.id === localParticipant?.id;
  const isTargetPeerHost = peerRole === 'host';
  const isCoHostTryingToAccessHost = localRole === 'co-host' && isTargetPeerHost;

  // Get peer metadata
  const getPeerMetadata = () => {
    try {
      if (peer.metadata) {
        return JSON.parse(peer.metadata);
      }
    } catch (e) {}
    return {};
  };

  const peerMetadata = getPeerMetadata();
  const isPeerAudioEnabled = peer.audioEnabled;

  // Fetch token prices
  const fetchTokenPrices = async () => {
    try {
      setIsFetchingPrices(true);
      
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
          const ethData = await response.json();
          const ethPriceUsd = ethData?.ethereum?.usd;
          if (ethPriceUsd) {
            setEthPrice(ethPriceUsd);
          }
        }
      } catch (ethError) {
        console.error('Error fetching ETH price:', ethError);
      }

      try {
        const fireResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${FIRE_ADDRESS}`
        );
        
        if (fireResponse.ok) {
          const fireData = await fireResponse.json();
          const firePriceUsd = fireData?.pairs?.[0]?.priceUsd;
          if (firePriceUsd) {
            setFirePrice(parseFloat(firePriceUsd));
          }
        }
      } catch (fireError) {
        console.error('Error fetching FIRE price:', fireError);
      }
    } catch (error) {
      console.error('Error fetching token prices:', error);
    } finally {
      setIsFetchingPrices(false);
    }
  };

  // Monitor transaction status
  useEffect(() => {
    const handleTransactionStatus = async () => {
      if (isSuccess) {
        await processSuccess(lastCurrencyRef.current);
      } else if (status === 'error') {
        toast.error('Transaction failed. Please try again.');
        setIsTipping(false);
      }
    };
    handleTransactionStatus();
  }, [isSuccess, status]);

  // Fetch prices when tip drawer opens
  useEffect(() => {
    if (isTipDrawerOpen) {
      fetchTokenPrices();
    }
  }, [isTipDrawerOpen]);

  useEffect(() => {
    if (isVisible && !isCoHostTryingToAccessHost) {
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsOpen(false);
      document.body.style.overflow = 'unset';
    }
  }, [isVisible, isCoHostTryingToAccessHost]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  /**
   * Handle role change using Stage Management
   * 
   * For speaker promotion: grantAccess(userIds)
   * For listener demotion: kick(userIds) from stage
   * 
   * Note: Uses userId (persistent), not id (session)
   */
  const handleRoleChange = async (newRole: string) => {
    const env = process.env.NEXT_PUBLIC_ENV;
    let token = "";
    if (env !== "DEV") {
      token = (await sdk.quickAuth.getToken()).token;
    }
    
    try {
      setIsLoading(true);
      
      // Use userId for Stage APIs (not id)
      const targetUserId = peer.userId;
      
      if (newRole === 'speaker') {
        // Promote to speaker using Stage Management
        await acceptStageRequest([targetUserId]);
      } else if (newRole === 'listener') {
        // Demote to listener using Stage Management
        await removeFromStage([targetUserId]);
      }
      // Note: co-host and host changes would need backend REST API
      // which will be implemented in Phase 9
      
      // Sync role change with Redis
      try {
        const userFid = peerMetadata?.fid;
        
        if (userFid) {
          const pathParts = window.location.pathname.split('/');
          const roomId = pathParts[pathParts.length - 1];
          await updateParticipantRole(roomId, userFid, newRole, token);
        }
      } catch (redisError) {
        console.error('Error syncing role with Redis:', redisError);
      }
      
      toast.success(`Changed ${peer.name}'s role to ${newRole}`);
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Failed to change role');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mute participant using participant.disableAudio()
   */
  const handleMuteToggle = async () => {
    if (!canMute) return;
    try {
      await muteParticipant(peer.id);
      toast.success(`Muted ${peer.name}`);
      onClose();
    } catch (err) {
      console.error('Remote mute failed:', err);
      toast.error('Failed to mute user');
    }
  };

  /**
   * Remove user using participant.kick()
   */
  const handleRemoveUser = async () => {
    if (!canKick) return;
    try {
      await kickParticipant(peer.id);
      toast.success(`Removed ${peer.name} from room`);
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
      toast.error('Failed to remove user');
    }
  };

  const handleViewProfile = async () => {
    try {
      const userFid = peerMetadata?.fid;
      
      if (userFid) {
        await sdk.actions.viewProfile({ 
          fid: parseInt(userFid)
        });
        onClose();
      } else {
        console.error('User FID not found in peer metadata');
      }
    } catch (error) {
      console.error('Error viewing profile:', error);
    }
  };

  const processSuccess = async (currency: string) => {
    const tipAmountUSD = parseFloat(tipAmount);
    const tipper = user?.username || 'Someone';
    const recipient = peer.name || 'User';
    
    toast.success('Tip sent successfully!');
    setIsTipDrawerOpen(false);
    setTipAmount('');
    setIsTipping(false);
    onClose();
  };

  const handleETHTip = async () => {
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      if (!ethPrice) {
        toast.error('ETH price not available. Please try again.');
        setIsTipping(false);
        return;
      }
      
      const recipientWallet = peerMetadata?.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = 'ETH';
      
      const tipAmountUSD = parseFloat(tipAmount);
      const tipAmountETH = tipAmountUSD / ethPrice;
      const ethValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));
      
      const sendingCalls: TransactionCall[] = [{
        to: contractAdds.tipping as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? ethValueInWei : numberToHex(ethValueInWei),
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeETH',
          args: [[recipientWallet]],
        }),
      }];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: context?.client.clientFid,
        sendCalls,
        onSuccess: async () => {
          await processSuccess('ETH');
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error('Error tipping with ETH:', error);
      toast.error(`Failed to process tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTipping(false);
    }
  };

  const handleTokenTip = async (tokenAddress: string, tokenSymbol: string) => {
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      const recipientWallet = peerMetadata?.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = tokenSymbol;
      
      const tipAmountUSD = parseFloat(tipAmount);
      let tokenAmount: bigint;
      
      if (tokenSymbol === 'USDC') {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      } else if (tokenSymbol === 'FIRE') {
        if (!firePrice) {
          toast.error('FIRE price not available. Please try again.');
          setIsTipping(false);
          return;
        }
        const tipAmountFIRE = tipAmountUSD / firePrice;
        tokenAmount = BigInt(Math.floor(tipAmountFIRE * 1e18));
      } else {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      }
      
      const approveCall = {
        to: tokenAddress as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : '0x0',
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAdds.tipping, tokenAmount],
        }),
      };
      
      const distributeCall = {
        to: contractAdds.tipping as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : '0x0',
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeToken',
          args: [tokenAddress, [recipientWallet], tokenAmount],
        }),
      };
      
      const sendingCalls: TransactionCall[] = [approveCall, distributeCall];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: context?.client.clientFid,
        sendCalls,
        onSuccess: async () => {
          await processSuccess(tokenSymbol);
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error(`Error tipping with ${tokenSymbol}:`, error);
      toast.error('Failed to process tip. Please try again.');
      setIsTipping(false);
    }
  };

  if ((!isVisible && !isTipDrawerOpen) || isLocalUser) {
    return null;
  }

  const canManageRoles = isLocalHostOrCohost && !isCoHostTryingToAccessHost;
  const isMuted = !isPeerAudioEnabled;

  const modalContent = (
    <>
      {/* Backdrop */}
      {isVisible && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          onClick={onClose}
        />
      )}
      
      {/* Modal */}
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <Card
            ref={menuRef}
            className="bg-[#000000] rounded-xl shadow-2xl w-full max-w-sm mx-4 transform transition-all duration-200 ease-out"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info Header */}
            <div className="px-6 py-4 border-b border-white/10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                  {peerMetadata.avatar || peer.picture ? (
                    <Image 
                      unoptimized 
                      src={peerMetadata.avatar || peer.picture} 
                      alt={`${peer.name}'s avatar`} 
                      width={48} 
                      height={48} 
                      className="rounded-full w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="text-white text-lg font-medium">
                      {peer.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">{peer.name}</p>
                  <p className="text-gray-400 text-sm capitalize">{peerRole}</p>
                </div>
              </div>
            </div>

            {/* View Profile Option */}
            <div className="py-2">
              <button
                onClick={handleViewProfile}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
              >
                <span className="w-5 h-5">👤</span>
                <span className="font-medium">View Profile</span>
              </button>
              
              {/* Tip User Option */}
              <button
                onClick={() => {
                  setIsTipDrawerOpen(true);
                  onClose();
                }}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
              >
                <span className="w-5 h-5">💸</span>
                <span className="font-medium">Tip User</span>
              </button>
            </div>

            {/* Role Management Options */}
            {canManageRoles && (
              <div className="py-2 border-t border-gray-600">
                {/* Make Speaker (uses Stage grantAccess) */}
                {peerRole !== 'speaker' && peerRole === 'listener' && (
                  <button
                    onClick={() => handleRoleChange('speaker')}
                    disabled={isLoading}
                    className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
                  >
                    <MdArrowUpward className="w-5 h-5" />
                    <span className="font-medium">{isLoading ? 'Changing...' : 'Make Speaker'}</span>
                  </button>
                )}

                {/* Make Listener (uses Stage kick) */}
                {peerRole === 'speaker' && (
                  <button
                    onClick={() => handleRoleChange('listener')}
                    disabled={isLoading}
                    className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
                  >
                    <MdArrowDownward className="w-5 h-5" />
                    <span className="font-medium">{isLoading ? 'Changing...' : 'Make Listener'}</span>
                  </button>
                )}

                {/* Mute - only show for speakers who are NOT muted */}
                {(peerRole === 'speaker' || peerRole === 'co-host') && canMute && !isMuted && (
                  <button
                    onClick={handleMuteToggle}
                    className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
                  >
                    <MdMicOff className="w-5 h-5" />
                    <span className="font-medium">Mute</span>
                  </button>
                )}

                {/* Remove User (only for host) */}
                {localRole === 'host' && canKick && (
                  <div className="border-t border-gray-600 mt-2 pt-2">
                    <button
                      onClick={handleRemoveUser}
                      className="w-full px-6 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
                    >
                      <MdPersonRemove className="w-5 h-5" />
                      <span className="font-medium">Remove User</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <div className="px-6 py-3 border-t border-gray-600">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-full px-4 py-2 text-center text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Tip Drawer */}
      <Drawer open={isTipDrawerOpen} onOpenChange={setIsTipDrawerOpen}>
        <DrawerContent className="bg-black/95 backdrop-blur-lg text-white border-fireside-orange/30">
          <DrawerHeader className="border-b border-orange-500/30">
            <DrawerTitle className="text-2xl font-bold text-center text-white">
              Tip <span className='gradient-fire-text'>{peer.name}</span>
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="px-4 py-6 space-y-6">
            {/* Recipient Info */}
            <Card className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                {peerMetadata.avatar || peer.picture ? (
                  <Image 
                    unoptimized 
                    src={peerMetadata.avatar || peer.picture} 
                    alt={`${peer.name}'s avatar`} 
                    width={48} 
                    height={48} 
                    className="rounded-full w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-white text-lg font-medium">
                    {peer.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold">{peer.name}</p>
                <p className="text-gray-400 text-sm capitalize">{peerRole}</p>
              </div>
            </Card>
            
            {/* Tip Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tip Amount (USD)
              </label>
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Enter amount in USD"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fireside-orange"
                min="0"
                step="0.01"
                disabled={isTipping}
              />
            </div>
            
            {/* Token Price Info */}
            {isFetchingPrices ? (
              <div className="text-center text-gray-400 text-sm">
                Fetching token prices...
              </div>
            ) : (
              <div className="text-sm text-gray-400 space-y-1">
                {ethPrice && <p>ETH: ${ethPrice.toFixed(2)}</p>}
                {firePrice && <p>FIRE: ${firePrice.toFixed(6)}</p>}
                <p>USDC: $1.00</p>
              </div>
            )}
          </div>
          
          <DrawerFooter className="border-t border-fireside-orange/30">
            <div className="space-y-3">
              <button
                onClick={handleETHTip}
                disabled={isTipping || !tipAmount || !ethPrice || isFetchingPrices}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'ETH' ? 'Processing...' : 'Tip in ETH'}
              </button>
              
              <button
                onClick={() => handleTokenTip(USDC_ADDRESS, 'USDC')}
                disabled={isTipping || !tipAmount || isFetchingPrices}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'USDC' ? 'Processing...' : 'Tip in USDC'}
              </button>
              
              <button
                onClick={() => handleTokenTip(FIRE_ADDRESS, 'FIRE')}
                disabled={isTipping || !tipAmount || !firePrice || isFetchingPrices}
                className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isTipping && lastCurrencyRef.current === 'FIRE' ? 'Processing...' : 'Tip in FIRE'}
              </button>
              
              <button
                onClick={() => {
                  setIsTipDrawerOpen(false);
                  setTipAmount('');
                }}
                disabled={isTipping}
                className="w-full px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

