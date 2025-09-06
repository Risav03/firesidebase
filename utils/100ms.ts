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

// export class HMSAPI {
//   private baseUrl = 'https://api.100ms.live/v2';
//   private managementToken: string;
//   private templateId: string;

//   constructor() {
//     this.managementToken = process.env.HUNDRED_MS_MANAGEMENT_TOKEN || '';
//     this.templateId = process.env.HUNDRED_MS_TEMPLATE_ID || '';
    
//     if (!this.managementToken) {
//       throw new Error('HUNDRED_MS_MANAGEMENT_TOKEN is required');
//     }
    
//     if (!this.templateId) {
//       throw new Error('HUNDRED_MS_TEMPLATE_ID is required');
//     }
//   }

//   private async makeRequest<T>(
//     endpoint: string, 
//     method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
//     body?: any
//   ): Promise<T> {
//     const response = await fetch(`${this.baseUrl}${endpoint}`, {
//       method,
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${this.managementToken}`
//       },
//       body: body ? JSON.stringify(body) : undefined
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       let errorObj;
//       try {
//         errorObj = JSON.parse(errorText);
//       } catch (e) {
//         errorObj = { message: errorText };
//       }

//       console.log('100ms API error response:', errorObj);
      
//       // Check for duplicate room name error
//       if (errorObj.message && 
//           (errorObj.message.includes('duplicate') || 
//            errorObj.message.includes('already exists') ||
//            errorObj.code === 'room_name_taken') || errorObj.message.includes('room not active')) {
//         throw new Error(`duplicate:${errorObj.message}`);
//       }
      
//       throw new Error(`100ms API error: ${response.status} - ${errorText}`);
//     }

//     return response.json();
//   }

//   async createRoom(name: string, description: string): Promise<CreateRoomResponse> {
//     // Create a sanitized version of the name for 100ms
//     const sanitizedName = name.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Fireside Room';
    
//     try {
//       return await this.makeRequest<CreateRoomResponse>('/rooms', 'POST', {
//         name: sanitizedName,
//         description,
//         template_id: this.templateId
//       });
//     } catch (error: any) {
//       // Check if error is due to duplicate room name
//       if (error.message && error.message.includes('duplicate')) {
//         console.log(`Room name "${sanitizedName}" already exists, trying with random suffix`);
//         // Add random string to name and retry
//         const randomSuffix = Math.random().toString(36).substring(2, 8);
//         const uniqueName = `${sanitizedName} ${randomSuffix}`;
        
//         try {
//           return await this.makeRequest<CreateRoomResponse>('/rooms', 'POST', {
//             name: uniqueName,
//             description,
//             template_id: this.templateId
//           });
//         } catch (retryError) {
//           console.error('Failed to create room even with random suffix:', retryError);
//           throw retryError;
//         }
//       }
//       // Re-throw for other errors
//       throw error;
//     }
//   }

//   async generateRoomCodes(roomId: string): Promise<RoomCodeResponse[]> {
//     return this.makeRequest<RoomCodeResponse[]>(`/room-codes/room/${roomId}`, 'POST');
//   }

//   async getRoomCodes(roomId: string): Promise<{ data: RoomCodeResponse[] }> {
//     return this.makeRequest<{ data: RoomCodeResponse[] }>(`/room-codes/room/${roomId}`, 'GET');
//   }
// }
