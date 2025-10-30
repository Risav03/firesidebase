'use server'

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  authToken?: string | null;
  cache?: RequestCache;
};

/**
 * Single server action for making API requests from the server side
 * 
 * This ensures all API calls originate from Vercel servers, not the client
 * 
 * @param url - The URL to fetch from
 * @param options - Request options (method, body, headers, authToken, cache)
 * @returns Response object with data, status and ok flag
 */
export async function fetchAPI(url: string, options: FetchOptions = {}) {
  try {
    console.log(`Server fetch to: ${url} with options:`, options);
    const {
      method = 'GET',
      body,
      headers = {},
      authToken,
      cache
    } = options;

    // Set up headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    // Add auth header if provided
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    } else {
      // DEV fallback: use NEXT_PUBLIC_DEV_HEADER as raw token (no prefix)
      const isDevEnv = process.env.NEXT_PUBLIC_ENV === 'DEV';
      const devToken = process.env.NEXT_PUBLIC_DEV_HEADER; // expects just the JWT (e.g., ey...)
      const existingAuth = requestHeaders['Authorization'];
      const isInvalidAuth = typeof existingAuth === 'string' && existingAuth.includes('undefined');
      if (isDevEnv && devToken && (!existingAuth || isInvalidAuth)) {
        requestHeaders['Authorization'] = `Bearer ${devToken}`;
      }
    }

    // Create request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
    };

    // Add body for non-GET requests
    if (method !== 'GET' && body !== undefined) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Parse response
    const data = await response.json();

    console.log("response", data);    
    
    // Return formatted response
    return {
      data,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    console.error(`Server fetch error for ${url}:`, error);
    throw error;
  }
}

// Client-callable server actions for specific components

/**
 * Fetch user profile rooms (for profile page)
 */
export async function fetchUserRooms(username: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/username/${username}`);
}

/**
 * Fetch user profile by FID (for ViewProfileModal)
 */
export async function fetchUserByFid(fid: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/${fid}`);
}

/**
 * Update user profile (for profile page)
 */
export async function refreshUserProfile(token: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/update?query=profile`, {
    method: 'PATCH',
    authToken: token
  });
}

/**
 * Fetch room recordings (for recordings page)
 */
export async function fetchRoomRecordings(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/recordings`);
}

/**
 * Fetch room codes (for CallClient)
 */
export async function fetchRoomCodes(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/codes`);
}

/**
 * Get Agora RTC token (server-side issued)
 */
export async function getAgoraRtcToken(params: { channel: string; uid: string | number; role?: 'publisher' | 'subscriber' }, authToken: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/agora/rtc-token`, {
    method: 'POST',
    body: params,
    authToken,
  });
}

/**
 * Get Agora RTM token (server-side issued)
 */
export async function getAgoraRtmToken(params: { uid: string | number }, authToken: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/agora/rtm-token`, {
    method: 'POST',
    body: params,
    authToken,
  });
}

/**
 * Add participant to room
 */
export async function addParticipantToRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/join`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Remove participant from room
 */
export async function removeParticipantFromRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/leave`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Fetch chat messages for a room
 */
export async function fetchChatMessages(roomId: string, limit: number = 50) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/messages?limit=${limit}`);
}

/**
 * Send a chat message to a room
 */
export async function sendChatMessage(roomId: string, messageData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/messages`, {
    method: 'POST',
    body: messageData,
    authToken: token
  });
}

/**
 * Fetch room details by room ID
 */
export async function fetchRoomDetails(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}`);
}

/**
 * End a room session
 */
export async function endRoom(roomId: string, userId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/end`, {
    method: 'POST',
    body: { userId }
  });
}

/**
 * Update user topics
 */
export async function updateUserTopics(topics: string[], token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/topics`, {
    method: 'PATCH',
    body: { topics },
    authToken: token
  });
}

/**
 * Fetch user profile by handle
 */
export async function fetchUserByHandle(token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/handle`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch rooms by topics
 */
export async function fetchRoomsByTopics(topics: string[]) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/by-topics`, {
    method: 'POST',
    body: { topics }
  });
}

/**
 * Fetch all public rooms
 */
export async function fetchAllRooms() {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/`);
}

/**
 * End a protected room session
 */
export async function endProtectedRoom(roomId: string, userId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/end`, {
    method: 'POST',
    body: { userId },
    authToken: token
  });
}

/**
 * Fetch room participants
 */
export async function fetchRoomParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants`);
}

export async function fetchLiveParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants-live`);
}

/**
 * Fetch room participants by role
 */
export async function fetchRoomParticipantsByRole(roomId: string, role: string, activeOnly: boolean = true) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants?role=${role}&activeOnly=${activeOnly}`);
}

/**
 * Update room participant role
 */
export async function updateParticipantRole(roomId: string, userFid: string, newRole: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    },
    authToken: token
  });
}

/**
 * Transfer host role
 */
export async function transferHostRole(roomId: string, userFid: string, newRole: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    }
  });
}

/**
 * Search for users and rooms
 */
export async function searchUsersAndRooms(query: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/search?q=${encodeURIComponent(query.trim())}`);
}

/**
 * Create a new room
 */
export async function createRoom(roomData: {
  name: string;
  description: string;
  host: string;
  startTime: string;
  topics: string[];
  sponsorshipEnabled?: boolean;
}, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected`, {
    method: 'POST',
    body: roomData,
    authToken: token
  });
}

/**
 * Create a sponsorship for a room
 */
export async function createSponsorship(sponsorshipData: {
  roomId: string;
  duration: number;
  imageBuffer: string; // Changed from number[] to string to accept base64 data
}, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  console.log("Creating sponsorship with data:", {
    ...sponsorshipData,
    imageBuffer: sponsorshipData.imageBuffer.substring(0, 50) + '...' // Log only the start of the base64 string
  }, "and token:", token);

  return fetchAPI(`${URL}/api/sponsorships/protected/create`, {
    method: 'POST',
    body: sponsorshipData,
    authToken: token
  });
}

/**
 * Fetch pending sponsorships for a room (host only)
 */
export async function fetchPendingSponsorships(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/pending/${roomId}`, {
    method: 'GET',
    authToken: token
  });
}

/**
 * Update sponsorship status (approve or decline)
 */
export async function updateSponsorshipStatus(
  sponsorshipId: string, 
  status: 'approved' | 'declined', 
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/status/${sponsorshipId}`, {
    method: 'PATCH',
    body: { status },
    authToken: token
  });
}

/**
 * Fetch sponsorship status for a user
 */
export async function fetchSponsorshipStatus(
  sponsorshipId: string,
  roomId: string,
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/${sponsorshipId}/${roomId}`, {
    method: 'GET',
    authToken: token
  });
}

/**
 * Withdraw a sponsorship request
 */
export async function withdrawSponsorshipRequest(
  sponsorshipId: string,
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/${sponsorshipId}/withdraw`, {
    method: 'DELETE',
    authToken: token
  });
}

/**
 * Activate an approved sponsorship after successful payment
 */
export async function activateSponsorship(
  sponsorshipId: string,
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/${sponsorshipId}/activate`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch live sponsorships for a room
 */
export async function fetchLiveSponsorships(
  roomId: string,
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/sponsorships/protected/live/${roomId}`, {
    method: 'GET',
    authToken: token
  });
}

/**
 * Update room (for setting reminders or other updates)
 */
export async function updateRoom(
  roomId: string, 
  updateData: {
    interested?: string;
    status?: string;
    endTime?: string;
    participants?: string[];
    action?: 'add' | 'remove';
    sponsorshipEnabled?: boolean;
  }, 
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}`, {
    method: 'PUT',
    body: updateData,
    authToken: token
  });
}

/**
 * Start a room (create HMS room and set status to ongoing)
 */
export async function startRoom(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/start/${roomId}`, {
    method: 'POST',
    authToken: token
  });
}