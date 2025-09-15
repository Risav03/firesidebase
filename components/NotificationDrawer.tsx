"use client";

import { useGlobalContext } from "@/utils/providers/globalContext";

export default function NotificationDrawer() {
  const { isPopupOpen, setIsPopupOpen, handleAddFrame } = useGlobalContext();

  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center duration-200 transition-all z-50 ${isPopupOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="bg-gray-800 rounded-t-lg p-6 w-full max-w-md ">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-semibold text-white">
              Enable Notifications
            </h2>
            <p className="text-gray-300 mt-2">
              Would you like to receive notifications about Fireside events?
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              onClick={() => setIsPopupOpen(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAddFrame()}
              className="flex-1 gradient-fire text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
