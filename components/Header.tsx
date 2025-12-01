'use client'

import { ExitIcon } from "@100mslive/react-icons";
import {
  selectIsConnectedToRoom,
  selectHMSMessages,
  useHMSActions,
  useHMSStore,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import { useState, useEffect, useCallback } from 'react';
import RoomEndModal from './RoomEndModal';
import { TbShare3 } from "react-icons/tb";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { sdk } from "@farcaster/miniapp-sdk";
import { toast } from "react-toastify";
import { useAdsControlEvent } from '../utils/events';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { isAdsTester } from '@/utils/constants';
import Button from '@/components/UI/Button';
import { getAdsSessionState, startAdsSession, stopAdsSession } from '@/utils/serverActions';

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  roomId?: string;
}
import Image from "next/image";
import { useRouter } from "next/navigation";
import FiresideLogo from "./UI/firesideLogo";

export default function Header({ onToggleChat, isChatOpen = false, roomId }: HeaderProps) {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const messages = useHMSStore(selectHMSMessages);
  const hmsActions = useHMSActions();
  const router = useRouter();
  const localPeer = useHMSStore(selectLocalPeer);
  const [showRoomEndModal, setShowRoomEndModal] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isTogglingAds, setIsTogglingAds] = useState(false);
  const [adsRunning, setAdsRunning] = useState<boolean>(false);
  const { user } = useGlobalContext();

  // Ads control event hook
  const { notifyAdsControl } = useAdsControlEvent();

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const isHost = localPeer?.roleName === 'host';

  const canControlAds = Boolean(roomId && isHost && user?.fid && isAdsTester(user?.fid));

  const refreshAdsState = useCallback(async () => {
    if (!roomId || !canControlAds) return;
    try {
      const res = await getAdsSessionState(roomId);
      if (!res?.ok) return;
      const payload = res.data;
      const state = payload?.state || payload?.data?.state;
      setAdsRunning(state === 'running');
    } catch (error) {
      console.error('Failed to refresh ads state', error);
    }
  }, [roomId, canControlAds]);

  useEffect(() => {
    if (!canControlAds) return;
    refreshAdsState();
  }, [canControlAds, refreshAdsState]);

  useEffect(() => {
    if (!canControlAds) return;
    const id = setInterval(() => {
      refreshAdsState();
    }, 2000);
    return () => clearInterval(id);
  }, [canControlAds, refreshAdsState]);

  const buildAuthHeaderValue = async () => {
    const env = process.env.NEXT_PUBLIC_ENV;
    if (env === 'DEV') {
      return 'Bearer dev';
    }
    const tokenResponse = await sdk.quickAuth.getToken();
    if (!tokenResponse?.token) {
      throw new Error('Missing auth token');
    }
    return `Bearer ${tokenResponse.token}`;
  };

  const handleToggleAds = async () => {
    if (!roomId || !user) return;
    try {
      setIsTogglingAds(true);
      const authHeader = await buildAuthHeaderValue();
      if (!adsRunning) {
        await startAdsSession(roomId, authHeader);
        setAdsRunning(true);
        toast.success('Ads session started');
        notifyAdsControl('start', roomId);
        setTimeout(() => {
          refreshAdsState();
        }, 1500);
      } else {
        await stopAdsSession(roomId, authHeader);
        setAdsRunning(false);
        toast.success('Ads session stopped');
        notifyAdsControl('stop', roomId);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not toggle ads');
    } finally {
      setIsTogglingAds(false);
    }
  };

  const handleLeaveClick = () => {
    if (isHost) {
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      hmsActions.leave();
      router.push('/');
    }
  };

  async function composeCast() {
    try {
      await sdk.actions.composeCast({
        text: `I've just sparked up a Fireside! Come join the conversation https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`,
        embeds: [`https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`],
      });
    } catch (e) {
      console.error("Error composing cast:", e);
    }
  }

  const handleCopyURL = () => {
    const roomURL = `https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`;
    navigator.clipboard.writeText(roomURL).then(() => {
      toast.success("Room URL copied to clipboard!");
    }).catch((error) => {
      console.error("Failed to copy URL:", error);
      toast.error("Failed to copy URL to clipboard");
    });
  };

  const handleShareOnTwitter = () => {
    const roomURL = `https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`;
    const text = "I've just sparked up a Fireside! Come join the conversation";
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(roomURL)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-fireside-dark_orange px-6 h-16 my-auto">
        <div className="max-w-7xl h-full mx-auto flex items-center justify-between">
          <div className="flex items-start justify-start space-x-4">
            <FiresideLogo className="w-32 justify-start"/>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-3">
              {canControlAds && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleAds}
                  disabled={isTogglingAds}
                  title={adsRunning ? 'Stop Ads' : 'Display Ads'}
                >
                  {isTogglingAds ? (adsRunning ? 'Stopping…' : 'Starting…') : (adsRunning ? 'Stop Ads' : 'Display Ads')}
                </Button>
              )}
              {roomId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsShareMenuOpen((prev) => !prev)}
                  className="relative z-50 flex items-center space-x-2"
                  title="Share"
                >
                  <TbShare3 className="w-5 h-5" />
                  <span className="text-sm">Share</span>
                </Button>
              )}
              <Button
                id="leave-btn"
                variant="ghost"
                size="sm"
                className="bg-fireside-red px-2 py-1 flex items-center"
                onClick={handleLeaveClick}
              >
                <ExitIcon className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Share Menu Overlay */}
      <div onClick={() => setIsShareMenuOpen(false)} className={`fixed top-0 left-0 h-screen w-screen bg-black/30 duration-200 z-[1000] ${isShareMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {isShareMenuOpen && (
          <div className="absolute right-4 top-16 border border-white/10 mb-2 w-40 bg-gray-800 text-white rounded-lg ">
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                composeCast();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-t-lg shadow-none"
            >
              <MdOutlineIosShare className="w-5 h-5" />
              <span>Share on App</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleShareOnTwitter();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none shadow-none"
            >
              <FaXTwitter className="w-5 h-5" />
              <span>Share on X</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleCopyURL();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-b-lg shadow-none"
            >
              <MdCopyAll className="w-5 h-5" />
              <span>Copy URL</span>
            </Button>
          </div>
        )}
      </div>

      {/* Room End Modal */}
      {showRoomEndModal && roomId && (
        <RoomEndModal
          isVisible={showRoomEndModal}
          onClose={() => setShowRoomEndModal(false)}
          roomId={roomId}
        />
      )}
    </>
  );
}
