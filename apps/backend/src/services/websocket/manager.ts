/**
 * Interface for any WebSocket-like connection that can send messages.
 * Works with both Bun's ServerWebSocket and Elysia's WS wrapper.
 */
interface WSConnection {
  send(data: string | ArrayBufferLike | Uint8Array): void;
}

interface ConnectionState {
  rooms: Set<string>;
  userFid?: string;
}

/**
 * WebSocket Connection Manager
 * 
 * Tracks WebSocket connections and their room subscriptions.
 * Provides methods to broadcast messages to all connections in a room.
 */
class WebSocketManager {
  // roomId -> Set of WebSocket connections
  private rooms = new Map<string, Set<WSConnection>>();
  // ws -> connection state
  private connections = new Map<WSConnection, ConnectionState>();

  /**
   * Register a new WebSocket connection
   */
  registerConnection(ws: WSConnection) {
    this.connections.set(ws, { rooms: new Set() });
  }

  /**
   * Subscribe a connection to a room's messages
   */
  joinRoom(ws: WSConnection, roomId: string) {
    // Add to room set
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);

    // Track in connection state
    const state = this.connections.get(ws);
    if (state) {
      state.rooms.add(roomId);
    }

    console.log(`[WS] Connection joined room ${roomId} (${this.rooms.get(roomId)!.size} connections)`);
  }

  /**
   * Unsubscribe a connection from a room
   */
  leaveRoom(ws: WSConnection, roomId: string) {
    const roomConnections = this.rooms.get(roomId);
    if (roomConnections) {
      roomConnections.delete(ws);
      if (roomConnections.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    const state = this.connections.get(ws);
    if (state) {
      state.rooms.delete(roomId);
    }

    console.log(`[WS] Connection left room ${roomId}`);
  }

  /**
   * Set the authenticated user FID for a connection
   */
  setUserFid(ws: WSConnection, fid: string) {
    const state = this.connections.get(ws);
    if (state) {
      state.userFid = fid;
    }
  }

  /**
   * Get the user FID for a connection
   */
  getUserFid(ws: WSConnection): string | undefined {
    return this.connections.get(ws)?.userFid;
  }

  /**
   * Remove a connection and clean up all its room subscriptions
   */
  removeConnection(ws: WSConnection) {
    const state = this.connections.get(ws);
    if (state) {
      for (const roomId of state.rooms) {
        const roomConnections = this.rooms.get(roomId);
        if (roomConnections) {
          roomConnections.delete(ws);
          if (roomConnections.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }
    }
    this.connections.delete(ws);
  }

  /**
   * Broadcast a message to all connections in a room
   * Optionally exclude a specific connection (e.g., the sender)
   */
  broadcastToRoom(roomId: string, type: string, data: any, excludeWs?: WSConnection) {
    const roomConnections = this.rooms.get(roomId);
    if (!roomConnections || roomConnections.size === 0) return;

    const payload = JSON.stringify({ type, ...data });
    
    for (const ws of roomConnections) {
      if (ws === excludeWs) continue;
      try {
        ws.send(payload);
      } catch (err) {
        console.error('[WS] Error sending to connection:', err);
        this.removeConnection(ws);
      }
    }
  }

  /**
   * Send a message to a specific connection
   */
  sendTo(ws: WSConnection, type: string, data: any) {
    try {
      ws.send(JSON.stringify({ type, ...data }));
    } catch (err) {
      console.error('[WS] Error sending to connection:', err);
      this.removeConnection(ws);
    }
  }

  /**
   * Get connection count for a room
   */
  getRoomConnectionCount(roomId: string): number {
    return this.rooms.get(roomId)?.size || 0;
  }

  /**
   * Get total connection count
   */
  getTotalConnectionCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
