'use client'

import { useEffect, useState } from 'react';
import { useHMSActions } from '@100mslive/react-sdk';
import { useSpeakerRejectionEvent } from '@/utils/events';
import { updateParticipantRole } from '@/utils/serverActions';
import sdk from "@farcaster/miniapp-sdk";
import { Card } from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import { 
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerOverlay,
} from "@/components/UI/drawer";
import { FaCheck } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';

interface SpeakerRequest {
  peerId: string;
  peerName?: string;
  peerAvatar?: string | null;
  timestamp?: string;
}

interface SpeakerRequestsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requests: SpeakerRequest[] | undefined;
  onApprove: (request: SpeakerRequest) => void;
  onReject: (request: SpeakerRequest) => void;
  roomId: string;
}

export default function SpeakerRequestsDrawer({
  isOpen,
  onClose,
  requests = [], // Provide default empty array if undefined
  onApprove,
  onReject,
  roomId
}: SpeakerRequestsDrawerProps) {

  // console.log("REQUESTSSSS", requests);

  const hmsActions = useHMSActions();

  const handleApprove = async (request: SpeakerRequest) => {
    // Validate the request object
    if (!request || !request.peerId) {
      console.error('Invalid speaker request received for approval');
      return;
    }

    try {
      // First, call the onApprove callback to update state
      onApprove(request);

      // Then attempt to change the peer's role to speaker
      await hmsActions.changeRoleOfPeer(request.peerId, 'speaker', true);
      
      // Try to update the role in Redis too if metadata is available
      // try {
      //   // Get authentication token for non-dev environments
      //   const env = process.env.NEXT_PUBLIC_ENV;
      //   let token: string = "";
      //   if (env !== "DEV") {
      //     const authResult = await sdk.quickAuth.getToken();
      //     token = authResult.token;
      //   }

      //   // For the peer metadata, we can use the peerId to send to the server
      //   const userFid = request.peerId; // This will need to be handled differently in your server action
        
      //   if (userFid) {
      //     await updateParticipantRole(roomId, userFid, 'speaker', token);
      //   }
      // } catch (redisError) {
      //   console.error('Error updating role in Redis:', redisError);
      //   // Don't fail the main operation if Redis sync fails
      // }
    } catch (error) {
      console.error('Error approving speaker request:', error);
    }
  };

  // Use the utility function for speaker rejections
  const { rejectSpeakerRequest } = useSpeakerRejectionEvent();

  const handleReject = (request: SpeakerRequest) => {
    // Validate the request object
    if (!request || !request.peerId) {
      console.error('Invalid speaker request received for rejection');
      return;
    }
    
    // Trigger the SPEAKER_REJECTED event
    rejectSpeakerRequest(request.peerId);
    onReject(request);
  };

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const date = new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return 'Invalid time';
    }
  };

  // Ensure we have valid requests
  const safeRequests = Array.isArray(requests) ? requests.filter(req => req && req.peerId) : [];

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-black border-t-4 border-fireside-orange">
        <DrawerHeader className="border-b border-gray-800">
          <DrawerTitle className="text-white text-center">
            Speaker Requests {safeRequests.length > 0 && `(${safeRequests.length})`}
          </DrawerTitle>
          <DrawerClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </DrawerClose>
        </DrawerHeader>
        
        <div className="flex-grow overflow-y-auto p-4 max-h-[70vh]">
          {safeRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-center text-white">No pending speaker requests</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {safeRequests.map((request) => (
                <Card key={request.peerId} variant="ghost" className="p-4 flex items-center">
                  <div className="mr-3">
                    {request && request.peerAvatar ? (
                      <img 
                        src={request.peerAvatar} 
                        alt={request.peerName || 'User'} 
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-fireside-orange rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {(request && request.peerName) ? request.peerName.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="text-white font-medium">{request.peerName || 'Unknown User'}</p>
                    <p className="text-xs text-gray-400">{request.timestamp ? formatTime(request.timestamp) : 'Unknown time'}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="default"
                      onClick={() => request && handleApprove(request)}
                      className="bg-green-600 hover:bg-green-700 w-8 aspect-square rounded p-0"
                    >
                      <FaCheck className='mx-auto' />
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => request && handleReject(request)}
                      className="bg-red-600 hover:bg-red-700 w-8 aspect-square rounded p-0"
                    >
                      <MdClose className='mx-auto text-xl' />
                    </Button>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}