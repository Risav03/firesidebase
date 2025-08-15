# 100ms Clubhouse Clone Setup

## Environment Variables Required

Create a `.env.local` file in your project root with the following variables:

```bash
# MongoDB
MONGO_URI=your_mongodb_connection_string

# 100ms Configuration
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
- Generates room codes in 100ms (not stored in DB)

### 3. Get Room by ID
- **GET** `/api/rooms/[id]`
- Returns specific room with populated data

### 4. Get Room Codes
- **GET** `/api/rooms/[id]/codes`
- Returns room codes from 100ms for joining

### 5. Update Room
- **PUT** `/api/rooms/[id]/update`
- Body: `{ status?, endTime?, participants?, action? }`
- Updates room status, end time, and manages participants

## Test the APIs

Visit `/test/rooms` to access the test interface for:
- Creating new rooms
- Viewing existing rooms
- Clicking on rooms to join them automatically
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
}
```

## Next Steps

1. Set up your environment variables
2. Test the 100ms connection at `/api/test-100ms`
3. Test the database connection at `/api/test-db`
4. Test the room creation API
5. Test room joining by clicking on rooms in the test interface
6. Integrate with your frontend components
7. Add authentication and authorization
8. Implement real-time updates for room status

## Troubleshooting

### 100ms Token Issues
If you get a "Token validation error" from 100ms:
1. Check that your `HUNDRED_MS_MANAGEMENT_TOKEN` is valid and not expired
2. The token should be a valid JWT token from 100ms dashboard
3. Test the connection at `/api/test-100ms` first
4. Make sure your 100ms account has the correct permissions

## Room Joining Flow

1. User clicks on a room in `/test/rooms`
2. Redirects to `/call/[roomId]`
3. Page automatically fetches room codes from 100ms
4. Determines user role (host if user created the room, listener otherwise)
5. Joins room with appropriate role using 100ms room code
6. Shows Conference component with Header and Footer

## User Management Features

### Host Controls
- **Role Management**: Hosts can change user roles (speaker, co-host, listener)
- **User Removal**: Hosts can remove users from the room
- **Context Menu**: Right-click or tap on any user to see management options

### Role Hierarchy
- **Host**: Full control over room and users
- **Co-host**: Can manage other users but cannot remove host
- **Speaker**: Can speak and be heard
- **Listener**: Can only listen (muted by default)

### How to Use
1. Join a room as host or co-host
2. Click on any user's avatar
3. Context menu appears with available actions
4. Select desired action (change role, mute, remove)
5. Changes are applied immediately via 100ms API
