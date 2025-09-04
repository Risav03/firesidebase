"use client";
import { useEffect, useState } from "react";
import { useNavigateWithLoader } from "../utils/useNavigateWithLoader";
import FiresideLogo from "./UI/firesideLogo";

interface RoomEndScreenProps {
  onComplete: ({onComplete}: {onComplete: () => void}) => void;
}

export default function RoomEndScreen({onComplete}: {onComplete: () => void}) {
  const navigate = useNavigateWithLoader();
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete, navigate]);

  const handleGoHome = () => {
    // onComplete();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Fireside Logo */}
        <div className="mb-8">
          <FiresideLogo className="w-48 mx-auto" />
        </div>

        {/* Message */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-4">
            Host Ended the Space
          </h1>
          <p className="text-gray-400 text-sm">
            Thanks for joining! You will be redirected to home page in{" "}
            <span className="text-fireside-orange font-bold">{timeLeft}</span>{" "}
            seconds
          </p>
        </div>

        {/* Go Home Button */}
        <button
          onClick={handleGoHome}
          className="clubhouse-button clubhouse-button-primary px-8 py-3 text-sm font-semibold"
        >
          Go to Home Page
        </button>

        {/* Countdown Progress Bar */}
        <div className="mt-8">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-fireside-orange h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
