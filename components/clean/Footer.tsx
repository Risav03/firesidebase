"use client";

import { useState, useEffect } from "react";
// Avoid importing Agora types here because we declare the module as any in global d.ts

interface FooterProps {
  onLeave: () => void;
  microphoneTrack: any | null;
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
