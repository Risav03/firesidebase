'use client'

export const Loader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-fireside-beige to-amber-50">
    <div className="clubhouse-card p-8 text-center">
      <div className="w-16 h-16 bg-fireside-orange rounded-3xl flex items-center justify-center mx-auto mb-6">
        <span className="text-white font-bold text-2xl">🏠</span>
      </div>
      
      <div className="mb-4">
        <svg
          width={48}
          height={48}
          viewBox="0 0 50 50"
          className="mx-auto animate-spin"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            stroke="#55AB55"
            strokeWidth="4"
            strokeDasharray="70 30"
            fill="none"
          />
        </svg>
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting...</h2>
      <p className="text-gray-600 text-sm">Setting up your audio experience</p>
    </div>
  </div>
);
