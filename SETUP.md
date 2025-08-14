# 100ms Clubhouse Clone Setup

## Environment Variables Required

Create a `.env.local` file in your project root with the following variables:

```bash
# MongoDB
MONGO_URI=your_mongodb_connection_string

# 100ms Configuration
HUNDRED_MS_API_ACCESS_KEY=your_100ms_api_access_key
HUNDRED_MS_APP_SECRET=your_100ms_app_secret
HUNDRED_MS_MANAGEMENT_TOKEN=your_100ms_management_token
HUNDRED_MS_TEMPLATE_ID=your_100ms_template_id
```

## API Endpoints Created

### 1. Get All Rooms
- **GET** `/api/rooms`
- Returns all enabled rooms with populated host and participants

### 2. Create Room
- **POST** `/api/rooms/create`
- Body: `{ name, description, host, startTime }`
- Creates room in 100ms and saves to database
- Generates room codes for all roles (host, speaker, listener)

### 3. Get Room by ID
- **GET** `/api/rooms/[id]`
- Returns specific room with populated data

### 4. Update Room
- **PUT** `/api/rooms/[id]/update`
- Body: `{ status?, endTime?, participants?, action? }`
- Updates room status, end time, and manages participants

## Test the APIs

Visit `/test/rooms` to access the test interface for:
- Creating new rooms
- Viewing existing rooms
- Testing room management functionality

## Database Schemas

### User Schema
```typescript
{
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
  bio?: string;
}
```

### Room Schema
```typescript
{
  name: string;
  enabled: boolean;
  description: string;
  host: string; // userId
  participants: string[]; // userIds
  startTime: Date;
  endTime: Date | null;
  status: 'upcoming' | 'ongoing' | 'ended';
  roomId: string; // 100ms room ID
  roomCodes: {
    host: string;
    speaker: string;
    listener: string;
  };
}
```

## Next Steps

1. Set up your environment variables
2. Test the room creation API
3. Integrate with your frontend components
4. Add authentication and authorization
5. Implement real-time updates for room status
