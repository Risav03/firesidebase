'use client'

import { useState, useRef } from 'react';
import Peer from './Peer';
import UserContextMenu from './UserContextMenu';
import ViewProfileModal from './ViewProfileModal';
import { useGlobalContext } from '@/utils/providers/globalContext';

interface PeerWithContextMenuProps {
  peer: any;
  meRole?: string;
}

export default function PeerWithContextMenu({ peer, meRole }: PeerWithContextMenuProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user } = useGlobalContext();
  const peerRef = useRef<HTMLDivElement>(null);

  // Check if local user is host or co-host
  const isLocalUser = (() => {
    try { return String(JSON.parse(peer?.metadata || '{}')?.fid || '') === String(user?.fid || ''); } catch { return false; }
  })();
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // No HMS localPeer; co-host gating handled inside UserContextMenu based on role
  const isCoHostTryingToAccessHost = false;

  const handlePeerClick = (event: React.MouseEvent) => {
    // Don't show menu for local user
    if (isLocalUser) return;

    event.preventDefault();
    event.stopPropagation();
    setShowContextMenu(true);
  };

  const handleContextMenuClose = () => {
    setShowContextMenu(false);
  };

  const handleViewProfile = () => {
    setShowProfileModal(true);
  };

  const handleProfileModalClose = () => {
    setShowProfileModal(false);
  };

  return (
    <div ref={peerRef} className="relative">
      <div onClick={handlePeerClick}>
        <Peer peer={peer} />
      </div>

      {!isLocalUser && (
        <UserContextMenu
          peer={peer}
          meRole={meRole}
          isVisible={showContextMenu}
          onClose={handleContextMenuClose}
          onViewProfile={handleViewProfile}
          position={{ x: 0, y: 0 }} // Not used anymore but keeping for compatibility
        />
      )}

      <ViewProfileModal
        peer={peer}
        isVisible={showProfileModal}
        onClose={handleProfileModalClose}
      />
    </div>

  );
}
