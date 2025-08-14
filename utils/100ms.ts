interface CreateRoomResponse {
  id: string;
  name: string;
  description: string;
  template_id: string;
  created_at: string;
  updated_at: string;
}

interface RoomCodeResponse {
  id: string;
  code: string;
  role: string;
  room_id: string;
  created_at: string;
  updated_at: string;
}

export class HMSAPI {
  private baseUrl = 'https://api.100ms.live/v2';
  private managementToken: string;
  private templateId: string;

  constructor() {
    this.managementToken = process.env.HUNDRED_MS_MANAGEMENT_TOKEN || '';
    this.templateId = process.env.HUNDRED_MS_TEMPLATE_ID || '';
    
    if (!this.managementToken) {
      throw new Error('HUNDRED_MS_MANAGEMENT_TOKEN is required');
    }
    
    if (!this.templateId) {
      throw new Error('HUNDRED_MS_TEMPLATE_ID is required');
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.managementToken}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`100ms API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createRoom(name: string, description: string): Promise<CreateRoomResponse> {
    return this.makeRequest<CreateRoomResponse>('/rooms', 'POST', {
      name,
      description,
      template_id: this.templateId
    });
  }

  async generateRoomCodes(roomId: string): Promise<RoomCodeResponse[]> {
    return this.makeRequest<RoomCodeResponse[]>(`/room-codes/room/${roomId}`, 'POST');
  }
}
