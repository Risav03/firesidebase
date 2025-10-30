'use client'

interface PeerProps {
  peer: { id: string; name: string; roleName?: string; isLocal?: boolean; metadata?: string; muted?: boolean; handRaised?: boolean; speaking?: boolean };
}

export default function Peer({ peer }: PeerProps) {
  const avatar = (() => {
    try { return peer.metadata ? JSON.parse(peer.metadata).avatar : ''; } catch { return ''; }
  })();

  return (
    <div className="relative flex flex-col items-center group">
      <div className="relative">
        <div className={` border-2 ${peer.isLocal ? "border-fireside-orange" : "border-white"} rounded-full relative ${peer.speaking ? 'ring-4 ring-fireside-orange/70 animate-pulse' : ''}`}>
          <div className={`w-16 h-16 rounded-full bg-fireside-orange flex items-center justify-center text-white text-2xl font-bold`}>
            {avatar ? (
              <div className="relative w-full h-full rounded-full overflow-hidden">
                <img src={avatar} alt={peer.name} className={`w-full h-full absolute z-40 rounded-full object-cover`} />
              </div>
            ) : (
              <span>{peer.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            )}
          </div>
          {peer.handRaised && (
            <div className="absolute -top-1 -left-1 z-50 bg-yellow-500 text-black rounded-full p-1 shadow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M7 11V5a2 2 0 114 0v6h1V7a2 2 0 114 0v8a4 4 0 11-8 0v-4H7z" />
              </svg>
            </div>
          )}
          {peer.muted && (
            <div className="absolute -bottom-1 -right-1 z-50 bg-red-600 text-white rounded-full p-1 shadow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-3-8V5a3 3 0 116 0v9m3.707 4.293l-12-12 1.414-1.414 12 12-1.414 1.414z" />
              </svg>
            </div>
          )}
        </div>
      </div>
      
      <div className={`mt-2 text-center`}>
        <p className="text-[0.8rem] font-medium text-white truncate max-w-20">
          {peer.name}
        </p>
        <div className="flex items-center justify-center space-x-1">
          {peer.roleName && (
            <span className={`text-xs leading-none font-semibold px-2 py-1 rounded-full ${
              peer.roleName === 'host' ? 'bg-red-500 text-white' :
              peer.roleName === 'co-host' ? 'bg-orange-500 text-white' :
              peer.roleName === 'speaker' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
            }`}>
              {peer.roleName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

