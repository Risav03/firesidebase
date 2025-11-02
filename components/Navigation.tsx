"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import CreateRoomModal from "@/components/CreateRoomModal";
import Image from "next/image";
import { IoMdHome } from "react-icons/io";
import { FaPlus } from "react-icons/fa";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { RiAdvertisementFill } from "react-icons/ri";
import { BiSolidVideoRecording } from "react-icons/bi";

export default function Navigation() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useGlobalContext();
  const navigate = useNavigateWithLoader();
  const indicatorRef = useRef<HTMLDivElement>(null);

  const isHomePage = pathname === '/';
  const isProfilePage = pathname === '/profile';
  const isRecordingsPage = pathname === '/recordings';
  const isAdsPage = pathname === '/ads/purchase';

  // Since we're using inline styling, we can remove this effect
  // useEffect(() => {
  //   if (indicatorRef.current) {
  //     if (isHomePage) {
  //       indicatorRef.current.style.transform = 'translateX(0%)';
  //     } else if (isProfilePage) {
  //       indicatorRef.current.style.transform = 'translateX(200%)';
  //     }
  //   }
  // }, [pathname, isHomePage, isProfilePage]);

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
              className="absolute bottom-0 w-1/4 h-1 gradient-fire transition-transform duration-300 ease-in-out"
              style={{ 
                bottom: '-8px',
                opacity: isHomePage || isRecordingsPage || isAdsPage ? 1 : 0,
                transform: isHomePage
                  ? 'translateX(0%)'
                  : isRecordingsPage
                  ? 'translateX(100%)'
                  : isAdsPage
                  ? 'translateX(200%)'
                  : 'translateX(0%)'
              }}
            />
          </div>
          
          <div className="flex w-full items-center justify-between">
            {/* Explore Button */}
            <button
              onClick={handleExploreClick}
              className={`flex flex-col items-center w-1/4 transition-colors ${
                isHomePage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <IoMdHome className={`text-2xl ${isHomePage ? "text-orange-500" : "text-white"}`} />
              <span className="text-xs">Explore</span>
            </button>

            {/* Recordings Button */}
            <button
              onClick={() => navigate("/recordings")}
              className={`flex flex-col items-center w-1/4 space-y-1 transition-colors ${
                isRecordingsPage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <BiSolidVideoRecording className={`w-6 h-6 text-2xl ${isRecordingsPage ? "text-orange-500" : "text-white"}`} />
              <span className="text-xs">Recordings</span>
            </button>

            {/* Ads Purchase Button */}
            <button
              onClick={() => navigate("/ads/purchase")}
              className={`flex flex-col items-center w-1/4 space-y-1 transition-colors ${
                isAdsPage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <RiAdvertisementFill className={`w-6 h-6 text-2xl ${isAdsPage ? "text-orange-500" : "text-white"}`} />
              <span className="text-xs">Ads</span>
            </button>

            {/* Create Room Button */}
            <div className="w-1/4 flex flex-col items-center">
              <button
                onClick={handleCreateRoom}
                className="gradient-fire text-white p-4 rounded-full font-bold transition-colors"
              >
                <FaPlus className="text-2xl" />
              </button>
            </div>
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
