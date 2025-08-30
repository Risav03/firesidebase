"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import CreateRoomModal from "@/components/CreateRoomModal";
import Image from "next/image";
import { IoMdHome } from "react-icons/io";
import { FaPlus } from "react-icons/fa";

export default function Navigation() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const { user } = useGlobalContext();

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  const handleProfileClick = () => {
    router.push("/profile");
  };

  const handleExploreClick = () => {
    router.push("/");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t pb-2 border-gray-600 z-50">
        <div className="max-w-md mx-auto w-full py-3">
          <div className="flex w-full items-center justify-between">
            {/* Explore Button */}
            <button
              onClick={handleExploreClick}
              className="flex flex-col items-center w-1/3 text-gray-300 hover:text-white transition-colors"
            >
              <IoMdHome className="text-white text-2xl" />
              <span className="text-xs">Explore</span>
            </button>

            {/* Create Room Button */}
            <div className="w-1/3 flex flex-col items-center">
              <button
                onClick={handleCreateRoom}
                className=" gradient-fire text-white p-4 rounded-full font-bold transition-colors"
              >
                <FaPlus className="text-2xl" />
              </button>
            </div>

            {/* Profile Button */}
            <button
              onClick={handleProfileClick}
              className="flex flex-col items-center w-1/3 space-y-1 text-gray-300 hover:text-white transition-colors"
            >
              {user ? (
                <>
                  <Image
                    src={user.pfp_url}
                    alt={user.displayName}
                    width={120}
                    height={120}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-xs">{user.displayName}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-xs">Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
}
