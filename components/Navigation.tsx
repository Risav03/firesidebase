"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import CreateRoomModal from "@/components/CreateRoomModal";
import Image from "next/image";
import { IoMdHome } from "react-icons/io";
import { FaPlus } from "react-icons/fa";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";

export default function Navigation() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useGlobalContext();
  const navigate = useNavigateWithLoader();
  const indicatorRef = useRef<HTMLDivElement>(null);

  const isHomePage = pathname === '/';
  const isProfilePage = pathname === '/profile';

  // Position the indicator based on active tab
  useEffect(() => {
    if (indicatorRef.current) {
      if (isHomePage) {
        indicatorRef.current.style.transform = 'translateX(0)';
      } else if (isProfilePage) {
        indicatorRef.current.style.transform = 'translateX(200%)';
      }
    }
  }, [isHomePage, isProfilePage]);

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleExploreClick = () => {
    navigate("/");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t pb-2 border-gray-600 z-50">
        <div className="max-w-md mx-auto w-full py-3">
          {/* Sliding Indicator */}
          <div className="relative -translate-y-4">
            <div 
              ref={indicatorRef} 
              className="absolute bottom-0 w-1/3 h-1 gradient-fire transition-transform duration-300 ease-in-out"
              style={{ 
                bottom: '-8px',
                opacity: isHomePage || isProfilePage ? 1 : 0
              }}
            />
          </div>
          
          <div className="flex w-full items-center justify-between">
            {/* Explore Button */}
            <button
              onClick={handleExploreClick}
              className={`flex flex-col items-center w-1/3 transition-colors ${
                isHomePage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <IoMdHome className={`text-2xl ${isHomePage ? "text-orange-500" : "text-white"}`} />
              <span className="text-xs">Explore</span>
            </button>

            {/* Create Room Button */}
            <div className="w-1/3 flex flex-col items-center">
              <button
                onClick={handleCreateRoom}
                className="gradient-fire text-white p-4 rounded-full font-bold transition-colors"
              >
                <FaPlus className="text-2xl" />
              </button>
            </div>

            {/* Profile Button */}
            <button
              onClick={handleProfileClick}
              className={`flex flex-col items-center w-1/3 space-y-1 transition-colors ${
                isProfilePage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              {user ? (
                <>
                  <div>
                    <Image
                      src={user.pfp_url}
                      alt={user.displayName}
                      width={120}
                      height={120}
                      className={`w-6 h-6 rounded-full ${isProfilePage ? "ring-2 ring-orange-500" : ""}`}
                    />
                  </div>
                  <span className="text-xs">{user.displayName}</span>
                </>
              ) : (
                <>
                  <svg
                    className={`w-6 h-6 ${isProfilePage ? "text-orange-500" : "text-white"}`}
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
      {/* {showCreateModal && ( */}
        <CreateRoomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      {/* )} */}
    </>
  );
}
