"use client";

import { useEffect, useState, useRef } from "react";
import Footer from "./Footer";

interface ConferenceProps {
  appId: string;
  channelName: string;
  token: string; // Required; must be valid for the provided username
  uid: string;   // Username (account). No fallbacks.
  onLeave: () => void;
}

function Conference({ appId, channelName, token, uid, onLeave }: ConferenceProps) {
  const [client, setClient] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<string[]>([]);

  // Use refs to track client and track for cleanup
  const clientRef = useRef<any>(null);
  const trackRef = useRef<any>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const initAgora = async () => {
      // Dynamically import Agora SDK to avoid SSR issues
      const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
      
      try {
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        // Join channel
        await agoraClient.join(appId, channelName, token, uid);
        
        // Enable and get local audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await agoraClient.publish([audioTrack]);
        
        setClient(agoraClient);
        setLocalAudioTrack(audioTrack);
        clientRef.current = agoraClient;
        trackRef.current = audioTrack;
        
        console.log("Joined channel:", channelName, "as username:", uid);

        // Listen for remote users
        const handleUserPublished = async (user: any, mediaType: "audio" | "video" | "datachannel") => {
          await agoraClient.subscribe(user, mediaType);
          
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            remoteAudioTrack?.play();
            const remoteId = String(user.uid);
            console.log("Remote user published:", remoteId, "type:", typeof user.uid);
            
            // Add user to the list when they publish
            setRemoteUsers(prev => (prev.includes(remoteId) ? prev : [...prev, remoteId]));
          }
        };
        agoraClient.on("user-published", handleUserPublished);

        const handleUserJoined = (user: any) => {
          console.log("User joined:", String(user.uid));
        };
        agoraClient.on("user-joined", handleUserJoined);

        const handleUserLeft = (user: any) => {
          const remoteId = String(user.uid);
          console.log("User left:", remoteId);
          setRemoteUsers(prev => prev.filter(u => u !== remoteId));
        };
        agoraClient.on("user-left", handleUserLeft);

        // Subscribe to already published users in the channel
        agoraClient.remoteUsers.forEach((user: any) => {
          agoraClient.subscribe(user, "audio").then(() => {
            user.audioTrack?.play();
            const remoteId = String(user.uid);
            console.log("Subscribed to existing user:", remoteId);
            setRemoteUsers(prev => (prev.includes(remoteId) ? prev : [...prev, remoteId]));
          });
        });

        // Save off for cleanup
        clientRef.current = agoraClient;
      } catch (error) {
        console.error("Error initializing Agora:", error);
      }
    };

    if (!joinedRef.current && appId && channelName && token && uid) {
      joinedRef.current = true;
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
        joinedRef.current = false;
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

  const totalUsers = 1 + remoteUsers.length; // Local + remote

  return (
    <>
      <div className="conference-section">
        <h2>Conference - {channelName}</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa' }}>
          {totalUsers} {totalUsers === 1 ? 'person' : 'people'} in channel
        </p>
        <div className="peers-container">
          {/* Local user (username) */}
          <div className="peer-container">
            <div className="peer-video">
              <div className="peer-avatar">{uid}</div>
            </div>
            <div className="peer-name">{uid} (You)</div>
          </div>

          {/* Remote users: we display the uid exactly as provided by Agora */}
          {remoteUsers.map((userId) => (
            <div key={userId} className="peer-container">
              <div className="peer-video">
                <div className="peer-avatar">{userId}</div>
              </div>
              <div className="peer-name">{userId}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer onLeave={handleLeave} microphoneTrack={localAudioTrack} />
    </>
  );
}

export default Conference;
