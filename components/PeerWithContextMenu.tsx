'use client'

import { useState, useRef } from 'react';
import { useHMSStore, selectLocalPeer } from '@100mslive/react-sdk';
import Peer from './Peer';
import UserContextMenu from './UserContextMenu';

interface PeerWithContextMenuProps {
  peer: any;
}

export default function PeerWithContextMenu({ peer }: PeerWithContextMenuProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const localPeer = useHMSStore(selectLocalPeer);
  const peerRef = useRef<HTMLDivElement>(null);

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  
  // Check if this is the local user
  const isLocalUser = peer.id === localPeer?.id;
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // Check if local user is co-host trying to access host's menu (not allowed)
  const isCoHostTryingToAccessHost = localPeer?.roleName === 'co-host' && isTargetPeerHost;

  const handlePeerClick = (event: React.MouseEvent) => {
    // Prevent co-hosts from accessing host's context menu
    if (!isHostOrCoHost || isLocalUser || isCoHostTryingToAccessHost) return;

    event.preventDefault();
    event.stopPropagation();
    setShowContextMenu(true);
  };

  const handleContextMenuClose = () => {
    setShowContextMenu(false);
  };

  return (
    <div ref={peerRef} className="relative">
      <div onClick={handlePeerClick}>
        <Peer peer={peer} />
      </div>

      {isHostOrCoHost && !isLocalUser && !isCoHostTryingToAccessHost && (<UserContextMenu
        peer={peer}
        isVisible={showContextMenu}
        onClose={handleContextMenuClose}
        position={{ x: 0, y: 0 }} // Not used anymore but keeping for compatibility
      />)}
    </div>

  );
}
