'use client'

import { useState, useEffect } from "react";
import {
  AudioLevelIcon,
  MicOffIcon,
  MicOnIcon,
  ShareScreenIcon,
} from "@100mslive/react-icons";
import {
  selectIsLocalAudioPluginPresent,
  selectIsLocalScreenShared,
  selectRoom,
  useAVToggle,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";
// Dynamic import to avoid SSR issues
let plugin: any = null;

export default function Footer() {
  const { isLocalAudioEnabled, toggleAudio } =
    useAVToggle();
  const amIScreenSharing = useHMSStore(selectIsLocalScreenShared);
  const actions = useHMSActions();
  const room = useHMSStore(selectRoom);
  const [isPluginActive, setIsPluginActive] = useState(false);
  const [isPluginReady, setIsPluginReady] = useState(false);

  // Initialize plugin only on client side with dynamic import
  useEffect(() => {
    if (typeof window !== 'undefined' && !plugin) {
      import('@100mslive/hms-noise-cancellation').then(({ HMSKrispPlugin }) => {
        plugin = new HMSKrispPlugin();
        setIsPluginReady(true);
      }).catch(error => {
        console.error('Failed to load noise cancellation plugin:', error);
      });
    }
  }, []);

  const isAudioPluginAdded = useHMSStore(
    selectIsLocalAudioPluginPresent(plugin?.getName() || '')
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          <button
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
              isLocalAudioEnabled 
                ? 'bg-clubhouse-green text-white shadow-lg' 
                : 'bg-red-500 text-white shadow-lg'
            }`}
            onClick={toggleAudio}
            title={isLocalAudioEnabled ? "Mute" : "Unmute"}
          >
            {isLocalAudioEnabled ? (
              <MicOnIcon className="w-6 h-6" />
            ) : (
              <MicOffIcon className="w-6 h-6" />
            )}
          </button>
          
          <button
            title="Screen share"
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
              amIScreenSharing 
                ? 'bg-clubhouse-blue text-white shadow-lg' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => actions.setScreenShareEnabled(!amIScreenSharing)}
          >
            <ShareScreenIcon className="w-6 h-6" />
          </button>
          
          {room?.isNoiseCancellationEnabled && isPluginReady && plugin && (
            <button
              title="Noise cancellation"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isPluginActive 
                  ? 'bg-clubhouse-purple text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={async () => {
                if (!plugin) return;
                
                if (isAudioPluginAdded) {
                  plugin.toggle();
                  setIsPluginActive((prev) => !prev);
                } else {
                  await actions.addPluginToAudioTrack(plugin);
                  setIsPluginActive(true);
                }
              }}
            >
              <AudioLevelIcon className="w-6 h-6" />
            </button>
          )}
        </div>
        
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            {isLocalAudioEnabled ? "Tap to mute" : "Tap to unmute"}
          </p>
        </div>
      </div>
    </div>
  );
}
