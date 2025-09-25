'use client'

import { useEffect, useState } from 'react';
import { useHMSActions } from '@100mslive/react-sdk';
import { updateParticipantRole } from '@/utils/serverActions';
import sdk from "@farcaster/miniapp-sdk";

interface SpeakerRequest {
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  timestamp: string;
}

interface SpeakerRequestsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requests: SpeakerRequest[];
  onApprove: (request: SpeakerRequest) => void;
  onReject: (request: SpeakerRequest) => void;
  roomId: string;
}

export default function SpeakerRequestsDrawer({
  isOpen,
  onClose,
  requests,
  onApprove,
  onReject,
  roomId
}: SpeakerRequestsDrawerProps) {
  const hmsActions = useHMSActions();

  const handleApprove = async (request: SpeakerRequest) => {
    try {
      // First, call the onApprove callback to update state
      onApprove(request);

      // Then attempt to change the peer's role to speaker
      await hmsActions.changeRole(request.peerId, 'speaker', true);
      
      // Try to update the role in Redis too if metadata is available
      try {
        // Get authentication token for non-dev environments
        const env = process.env.NEXT_PUBLIC_ENV;
        let token: string = "";
        if (env !== "DEV") {
          const authResult = await sdk.quickAuth.getToken();
          token = authResult.token;
        }

        // For the peer metadata, we can use the peerId to send to the server
        if (request.peerId) {
          // We don't have direct access to fid from here, so we'll send the peerId
          // The server-side function will need to handle lookup or use a different identifier
          const userFid = request.peerId; // This will need to be handled differently in your server action
          
          if (userFid) {
            await updateParticipantRole(roomId, userFid, 'speaker', token);
          }
        }
      } catch (redisError) {
        console.error('Error updating role in Redis:', redisError);
        // Don't fail the main operation if Redis sync fails
      }
    } catch (error) {
      console.error('Error approving speaker request:', error);
    }
  };

  const handleReject = (request: SpeakerRequest) => {
    // Trigger the SPEAKER_REJECTED event
    const rejectEvent = new CustomEvent('SPEAKER_REJECTED', {
      detail: {
        peerId: request.peerId
      }
    });
    window.dispatchEvent(rejectEvent);
    
    // Call the onReject callback to update state
    onReject(request);
  };

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-gray-900 w-full max-w-md h-full flex flex-col shadow-lg transform transition-transform duration-300">
        {/* Header */}
        <div className="border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Speaker Requests</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-4">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-center">No pending speaker requests</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => (
                <li key={request.peerId} className="bg-gray-800 rounded-lg p-4 flex items-center">
                  <div className="mr-3">
                    {request.peerAvatar ? (
                      <img 
                        src={request.peerAvatar} 
                        alt={request.peerName} 
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-fireside-orange rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {request.peerName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="text-white font-medium">{request.peerName}</p>
                    <p className="text-xs text-gray-400">{formatTime(request.timestamp)}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(request)}
                      className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}