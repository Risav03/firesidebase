/**
 * RealtimeKit (Cloudflare) API Service
 * 
 * Handles all interactions with the Cloudflare RealtimeKit REST API.
 * 
 * Documentation: https://docs.realtime.cloudflare.com
 * Developer Portal: https://dash.realtime.cloudflare.com
 * API Base URL: https://api.realtime.cloudflare.com/v2
 * 
 * Authentication:
 * - Uses HTTP Basic Auth with orgId:apiKey base64 encoded
 * - Header: "Authorization: Basic <base64(orgId:apiKey)>"
 * - The portal provides the pre-computed Authorization header
 * 
 * Key concepts:
 * - Presets: Permission bundles (create in portal, names must match exactly)
 * - Meetings: Rooms/sessions
 * - Participants: Users in a meeting (have userId for persistent ID, id for session)
 * 
 * NOTE: This is NOT the same as Dyte's API (api.dyte.io)
 * RealtimeKit has its own portal and API endpoints.
 */

import config from '../config';

/**
 * Preset names that map to 100ms roles
 * These should be configured in the RealtimeKit dashboard
 */
export const PRESETS = {
  HOST: 'host',
  COHOST: 'co-host', 
  SPEAKER: 'speaker',
  LISTENER: 'listener',
} as const;

export type PresetName = typeof PRESETS[keyof typeof PRESETS];

interface CreateMeetingResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    preferred_region: string;
    created_at: string;
    updated_at: string;
    record_on_start: boolean;
    live_stream_on_start: boolean;
    status: string;
  };
}

interface AddParticipantResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    picture?: string;
    custom_participant_id: string;
    preset_name: string;
    created_at: string;
    updated_at: string;
    token: string; // This is the authToken for the frontend
  };
}

interface MeetingParticipant {
  id: string;
  user_id: string;
  name: string;
  picture?: string;
  custom_participant_id?: string;
  preset_name: string;
  joined_at: string;
}

interface ListParticipantsResponse {
  success: boolean;
  data: MeetingParticipant[];
}

export class RealtimeKitAPI {
  private baseUrl: string;
  private orgId: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.realtimekitBaseUrl;
    this.orgId = config.realtimekitOrgId;
    this.apiKey = config.realtimekitApiKey;

    if (!this.apiKey || !this.orgId) {
      console.warn('⚠️ RealtimeKit API credentials not configured. Real-time features will not work.');
    }
  }

  /**
   * Get authorization header for API requests
   * RealtimeKit uses Basic auth with orgId:apiKey
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.orgId}:${this.apiKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make an authenticated request to the RealtimeKit API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.apiKey || !this.orgId) {
      throw new Error('RealtimeKit API credentials not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`[RealtimeKit API] ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj: any;
      try {
        errorObj = JSON.parse(errorText);
      } catch (e) {
        errorObj = { message: errorText };
      }

      console.error('[RealtimeKit API] Error:', errorObj);
      throw new Error(`RealtimeKit API error: ${response.status} - ${JSON.stringify(errorObj)}`);
    }

    return response.json();
  }

  /**
   * Create a new meeting (room)
   * 
   * @param title - Meeting title (room name)
   * @param preferredRegion - Optional preferred server region
   * @returns Meeting details including the meeting ID
   */
  async createMeeting(title: string, preferredRegion?: string): Promise<CreateMeetingResponse> {
    const body: any = {
      title: title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Fireside Room',
      preferred_region: preferredRegion || 'ap-south-1', // Default to India region
      record_on_start: false,
      live_stream_on_start: false,
    };

    return this.makeRequest<CreateMeetingResponse>('/meetings', 'POST', body);
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<CreateMeetingResponse> {
    return this.makeRequest<CreateMeetingResponse>(`/meetings/${meetingId}`, 'GET');
  }

  /**
   * Add a participant to a meeting
   * 
   * This returns an authToken that the frontend uses to join
   * 
   * @param meetingId - The meeting ID
   * @param name - Display name
   * @param presetName - Role preset (host, co-host, speaker, listener)
   * @param customParticipantId - Unique ID for this participant (e.g., FID)
   * @param picture - Optional profile picture URL
   * @returns Participant details including the authToken
   */
  async addParticipant(
    meetingId: string,
    name: string,
    presetName: PresetName,
    customParticipantId: string,
    picture?: string
  ): Promise<AddParticipantResponse> {
    const body: any = {
      name,
      preset_name: presetName,
      custom_participant_id: customParticipantId,
    };

    if (picture) {
      body.picture = picture;
    }

    return this.makeRequest<AddParticipantResponse>(
      `/meetings/${meetingId}/participants`,
      'POST',
      body
    );
  }

  /**
   * Get auth token for an existing participant
   * If the participant doesn't exist, creates them first
   * 
   * @param meetingId - The meeting ID
   * @param name - Display name
   * @param presetName - Role preset
   * @param customParticipantId - Unique ID (e.g., FID)
   * @param picture - Optional profile picture
   * @returns The auth token for joining
   */
  async getParticipantToken(
    meetingId: string,
    name: string,
    presetName: PresetName,
    customParticipantId: string,
    picture?: string
  ): Promise<string> {
    // Add participant always returns a token, even if they already exist
    const response = await this.addParticipant(
      meetingId,
      name,
      presetName,
      customParticipantId,
      picture
    );

    return response.data.token;
  }

  /**
   * List active participants in a meeting
   */
  async listParticipants(meetingId: string): Promise<ListParticipantsResponse> {
    return this.makeRequest<ListParticipantsResponse>(
      `/meetings/${meetingId}/participants`,
      'GET'
    );
  }

  /**
   * Kick a participant from the meeting
   * 
   * @param meetingId - The meeting ID
   * @param participantId - The participant's ID (from the API, not userId)
   */
  async kickParticipant(meetingId: string, participantId: string): Promise<void> {
    await this.makeRequest<void>(
      `/meetings/${meetingId}/participants/${participantId}`,
      'DELETE'
    );
  }

  /**
   * Update a participant's preset (role change)
   * Returns a new token that the participant should use to rejoin with new permissions
   * 
   * @param meetingId - The meeting ID
   * @param participantId - The participant's ID
   * @param newPreset - The new preset name
   * @returns Updated participant with new token
   */
  async updateParticipantPreset(
    meetingId: string,
    participantId: string,
    newPreset: PresetName
  ): Promise<AddParticipantResponse> {
    return this.makeRequest<AddParticipantResponse>(
      `/meetings/${meetingId}/participants/${participantId}`,
      'PATCH',
      { preset_name: newPreset }
    );
  }

  /**
   * End a meeting (kicks all participants)
   */
  async endMeeting(meetingId: string): Promise<void> {
    await this.makeRequest<void>(`/meetings/${meetingId}`, 'PUT', {
      status: 'CLOSED',
    });
  }

  /**
   * Check if the API is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.orgId);
  }
}

// Export singleton instance
export const realtimekitAPI = new RealtimeKitAPI();

