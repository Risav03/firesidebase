# Clubhouse-style Audio App (Next.js + Agora RTC/RTM)

A modern Clubhouse-style audio app built with Next.js 14, React 18, and Agora RTC (audio-only) + Agora RTM for chat and room events.

## Features

- 🎤 Audio-only rooms (Clubhouse-style)
- 💬 Real-time chat (Agora RTM)
- 👥 Roles: host, co-host, speaker, listener
- 🔊 Mic controls (publish/unpublish)
- ✋ Hand raise, emoji reactions (RTM events)
- 📱 Responsive UI with Tailwind CSS

## Tech Stack

- Next.js 14 (App Router), React 18, TypeScript
- Agora RTC NG (`agora-rtc-sdk-ng`) + `agora-rtc-react` hooks
- Agora RTM (`agora-rtm-sdk`) for chat and control events
- Tailwind CSS

## Project Structure

```
clubhouse-clone-react/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with Agora providers
│   └── page.tsx           # Main page component
├── components/            # React components (TypeScript)
│   ├── Conference.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── JoinForm.tsx
│   ├── Peer.tsx
│   ├── Loader.tsx
│   └── DeviceSettings.tsx
├── styles/               # Global styles
│   └── globals.css
├── public/               # Static assets
├── next.config.js        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

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

   Create `.env.local` with:
   ```env
   NEXT_PUBLIC_AGORA_APP_ID=your-agora-app-id
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   NEXT_PUBLIC_ENV=DEV
   ```

   Notes:
   - RTC/RTM tokens are issued by the backend: `/api/agora/rtc-token` and `/api/agora/rtm-token` (see `utils/serverActions.ts`).

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Agora Setup

1. Create a project in the [Agora Console](https://console.agora.io/) and copy the App ID.
2. Implement server endpoints to mint RTC/RTM tokens (keep your App Certificate secret on the server).
3. Set `NEXT_PUBLIC_AGORA_APP_ID` and backend URL in `.env.local`.

## Documentation

- [Agora React SDK docs](https://api-ref.agora.io/en/voice-sdk/reactjs/2.x/index.html)
- [Agora RTM Web SDK docs](https://api-ref.agora.io/en/rtm-web/docs/develop/overview)

This codebase has been migrated from 100ms to Agora RTC/RTM for audio-only parity and RTM-driven chat/events.
