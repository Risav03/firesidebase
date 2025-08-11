# Clubhouse Clone in React

A modern Clubhouse-style audio room application built with React 18 and the latest 100ms SDK.

## Features

- 🎤 Audio-only rooms (Clubhouse-style)
- 💬 Real-time chat
- 👥 User management with roles (Speaker, Listener, Moderator)
- 🔊 Audio controls (mute/unmute)
- 📱 Responsive design with Tailwind CSS

## Updated to Modern 100ms SDK

This project has been updated to use the latest `@100mslive/react-sdk` instead of the deprecated packages. Key improvements:

- ✅ React 18 compatibility
- ✅ Modern 100ms React SDK (`@100mslive/react-sdk`)
- ✅ Better performance and stability
- ✅ Latest 100ms features and APIs

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clubhouse-clone-react
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `example.env` to `.env` and fill in your 100ms credentials:
   ```bash
   cp example.env .env
   ```
   
   Update `.env` with your values from the 100ms Dashboard:
   ```
   REACT_APP_HMS_MANAGEMENT_TOKEN=your_management_token
   REACT_APP_HMS_ROOM_ID=your_room_id
   REACT_APP_HMS_TEMPLATE_ID=your_template_id (optional)
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

## 100ms Setup (Actual Modern Dashboard)

### Step 1: Create Your App
1. Visit the [100ms Dashboard](https://dashboard.100ms.live/)
2. Sign up or log in to your account
3. Create a new app

### Step 2: Get Developer Credentials
Go to **"Developer"** section in your app dashboard. You'll find:

- **App Access Key** - Used for server-side operations
- **App Secret** - Used with Access Key for authentication  
- **Management Token** - Used for API calls (this is what we need)
- **Token Validity** - How long tokens remain valid
- **Username/Password** - For basic auth scenarios
- **SIP Endpoint** - For telephony integration

**For this app, copy the `Management Token`** - this is used to generate user auth tokens.

### Step 3: Create a Room
1. Go to **"Rooms"** section in your dashboard
2. Click **"Create Room"** 
3. Configure your room settings
4. Copy the **Room ID** (not room name)

### Step 4: Set Up Templates (Optional)
1. Go to **"Templates"** section
2. Create or select a template that defines user roles and permissions
3. Copy the **Template ID** if you want to use a specific template

### Step 5: Update Environment Variables
Add your credentials to `.env`:
```env
# Required
REACT_APP_HMS_MANAGEMENT_TOKEN=your-management-token-here
REACT_APP_HMS_ROOM_ID=your-room-id-here

# Optional
REACT_APP_HMS_TEMPLATE_ID=your-template-id-here
```

## Tech Stack

- **React 18** - Latest React with modern features
- **100ms SDK** - Latest `@100mslive/react-sdk`
- **Tailwind CSS** - For styling
- **Craco** - For custom webpack configuration

## Documentation

- [100ms Documentation](https://www.100ms.live/docs)
- [100ms React SDK Guide](https://www.100ms.live/docs/react/v2/get-started/react-quickstart)

Have questions? [Join the 100ms Discord Server](https://www.100ms.live/discord)
