"use client";

import { useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import CreateRoomModal from "@/components/CreateRoomModal";
import { IoMdHome } from "react-icons/io";
import { FaPlus } from "react-icons/fa";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { RiAdvertisementFill } from "react-icons/ri";
import { FaRecordVinyl } from "react-icons/fa";
import { isAdsTester } from "@/utils/constants";
import Button from "./UI/Button";

export default function Navigation() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const pathname = usePathname();
  const { user } = useGlobalContext();
  const navigate = useNavigateWithLoader();
  const indicatorRef = useRef<HTMLDivElement>(null);

  const isHomePage = pathname === "/";
  const isRecordingsPage = pathname === "/recordings";
  const isAdsPage = pathname === "/ads/purchase";
  const showAdsButton = isAdsTester(user?.fid);
  const navColumnCount = showAdsButton ? 4 : 3;

  const indicatorVisible =
    isHomePage || isRecordingsPage || (showAdsButton && isAdsPage);
  const indicatorColumn = (() => {
    if (isRecordingsPage) return showAdsButton ? 2 : 2;
    if (isAdsPage && showAdsButton) return 3;
    return 0;
  })();

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  const handleExploreClick = () => {
    navigate("/");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-fireside-dark_orange pb-2  z-50">
        {showAdsButton && (
          <div className="gradient-fire px-2 py-2 text-white mb-1 flex items-center justify-between space-x-2">
            <div>
              <h2 className="text-white font-bold text-md">
                Sponsorship Ad Portal
              </h2>
              <p className="text-sm">
                Build reach with your target audience through ad banners
              </p>
            </div>

            <Button
              variant="action"
              onClick={() => navigate("/ads/purchase")}
              className={` rounded-md bg-white text-fireside-orange font-bold text-md px-6 py-2 `}
            >
              <span className="">Go</span>
            </Button>
          </div>
        )}

        <div className="max-w-md mx-auto w-full py-3">
          {/* Sliding Indicator */}
          <div className="relative -translate-y-4">
            <div
              ref={indicatorRef}
              className="absolute bottom-0 h-1 gradient-fire transition-transform duration-300 ease-in-out"
              style={{
                bottom: "-8px",
                width: `${100 / navColumnCount}%`,
                opacity: indicatorVisible ? 1 : 0,
                transform: `translateX(${indicatorColumn * 100}%)`,
              }}
            />
          </div>

          <div className={`grid grid-cols-3 w-full items-center gap-2`}>
            {/* Explore Button */}
            <button
              onClick={handleExploreClick}
              className={`flex flex-col items-center transition-colors ${
                isHomePage ? "text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <IoMdHome
                className={`text-2xl ${
                  isHomePage ? "text-orange-500" : "text-white"
                }`}
              />
              <span className="text-xs">Explore</span>
            </button>

            {/* Create Room Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleCreateRoom}
                className="gradient-fire text-white p-4 rounded-full font-bold transition-colors"
              >
                <FaPlus className="text-2xl" />
              </button>
            </div>

            {/* Recordings Button */}
            <button
              onClick={() => navigate("/recordings")}
              className={`flex flex-col items-center space-y-1 transition-colors ${
                isRecordingsPage
                  ? "text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <FaRecordVinyl
                className={`w-6 h-6 text-2xl ${
                  isRecordingsPage ? "text-orange-500" : "text-white"
                }`}
              />
              <span className="text-xs">Recordings</span>
            </button>
          </div>
        </div>
      </nav>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}
