"use client";

import { useEffect, useState, useRef } from "react";
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import Footer from "./Footer";

interface ConferenceProps {
  appId: string;
  channelName: string;
  token: string;
  uid: string;
  onLeave: () => void;
}

function Conference({ appId, channelName, token, uid, onLeave }: ConferenceProps) {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<(string | number)[]>([]);
  
  // Use refs to track client and track for cleanup
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const trackRef = useRef<IMicrophoneAudioTrack | null>(null);

  useEffect(() => {
    const initAgora = async () => {
      // Dynamically import Agora SDK to avoid SSR issues
      const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
      
      try {
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        // Join channel
        await agoraClient.join(
          appId, 
          channelName, 
          token || null, 
          uid || undefined
        );
        
        // Enable and get local audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await agoraClient.publish([audioTrack]);
        
        setClient(agoraClient);
        setLocalAudioTrack(audioTrack);
        clientRef.current = agoraClient;
        trackRef.current = audioTrack;
        
        console.log("Joined channel:", channelName);

        // Listen for remote users
        agoraClient.on("user-published", async (user: any, mediaType: "audio" | "video" | "datachannel") => {
          await agoraClient.subscribe(user, mediaType);
          
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            remoteAudioTrack?.play();
            console.log("Remote user joined:", user.uid);
          }
        });

        agoraClient.on("user-joined", (user: any) => {
          console.log("User joined:", user.uid);
          setRemoteUsers(prev => {
            if (!prev.includes(user.uid)) {
              return [...prev, user.uid];
            }
            return prev;
          });
        });

        agoraClient.on("user-left", (user: any) => {
          console.log("User left:", user.uid);
          setRemoteUsers(prev => prev.filter(u => u !== user.uid));
        });
      } catch (error) {
        console.error("Error initializing Agora:", error);
      }
    };

    if (appId && channelName) {
      initAgora();
    }

    return () => {
      const cleanup = async () => {
        if (trackRef.current) {
          trackRef.current.stop();
          trackRef.current.close();
          trackRef.current = null;
        }
        
        if (clientRef.current) {
          await clientRef.current.leave();
          clientRef.current = null;
        }
      };
      
      cleanup();
    };
  }, [appId, channelName, token, uid]);

  const handleLeave = async () => {
    // Cleanup before leaving
    if (trackRef.current) {
      trackRef.current.stop();
      trackRef.current.close();
      trackRef.current = null;
    }
    
    if (clientRef.current) {
      await clientRef.current.leave();
      clientRef.current = null;
    }
    
    onLeave();
  };

  return (
    <>
      <div className="conference-section">
        <h2>Conference - {channelName}</h2>
        <div className="peers-container">
          {/* Local user */}
          <div className="peer-container">
            <div className="peer-video">
              <div className="peer-avatar">You</div>
            </div>
            <div className="peer-name">Local User (You)</div>
          </div>

          {/* Remote users */}
          {remoteUsers.map((userId) => (
            <div key={userId} className="peer-container">
              <div className="peer-video">
                <div className="peer-avatar">{userId}</div>
              </div>
              <div className="peer-name">User {userId}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer onLeave={handleLeave} microphoneTrack={localAudioTrack} />
    </>
  );
}

export default Conference;
