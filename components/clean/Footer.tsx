"use client";

import { useState, useEffect } from "react";
import { IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

interface FooterProps {
  onLeave: () => void;
  microphoneTrack: IMicrophoneAudioTrack | null;
}

function Footer({ onLeave, microphoneTrack }: FooterProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);

  useEffect(() => {
    if (microphoneTrack) {
      // Initialize mute state from track
      setIsMicMuted(!microphoneTrack.enabled);
    }
  }, [microphoneTrack]);

  const toggleMicrophone = async () => {
    if (microphoneTrack) {
      try {
        await microphoneTrack.setEnabled(isMicMuted);
        setIsMicMuted(!isMicMuted);
        console.log(isMicMuted ? "Microphone unmuted" : "Microphone muted");
      } catch (error) {
        console.error("Error toggling microphone:", error);
      }
    }
  };

  return (
    <div className="control-bar">
      <button className="btn-control" onClick={toggleMicrophone}>
        {isMicMuted ? "Unmute" : "Mute"}
      </button>
      <button className="btn-control" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}

export default Footer;
