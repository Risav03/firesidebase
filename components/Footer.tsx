'use client'

import { useState, useEffect } from "react";
import {
  AudioLevelIcon,
  MicOffIcon,
  MicOnIcon,
  ShareScreenIcon,
  VideoOffIcon,
  VideoOnIcon,
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
  const { isLocalAudioEnabled, isLocalVideoEnabled, toggleAudio, toggleVideo } =
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
    <div className="control-bar">
      <button
        className={`btn-control ${isLocalAudioEnabled ? "" : "highlight"}`}
        onClick={toggleAudio}
      >
        {isLocalAudioEnabled ? <MicOnIcon /> : <MicOffIcon />}
      </button>
      <button
        className={`btn-control ${isLocalVideoEnabled ? "" : "highlight"}`}
        onClick={toggleVideo}
      >
        {isLocalVideoEnabled ? <VideoOnIcon /> : <VideoOffIcon />}
      </button>
      <button
        title="Screenshare"
        className={`btn-control ${amIScreenSharing ? "" : "highlight"}`}
        onClick={() => actions.setScreenShareEnabled(!amIScreenSharing)}
      >
        <ShareScreenIcon />
      </button>
      {room?.isNoiseCancellationEnabled && isPluginReady && plugin ? (
        <button
          title="Noise cancellation"
          className={`btn-control ${isPluginActive ? "" : "highlight"}`}
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
          <AudioLevelIcon />
        </button>
      ) : null}
    </div>
  );
}
