"use client";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "./UI/drawer";
import { useAddFrame, useNotification } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/miniapp-sdk";
import { updateUserNotificationToken } from "@/utils/serverActions";
import { IoMdNotifications } from "react-icons/io";
import { FaBell } from "react-icons/fa";
import { toast } from "react-toastify";
import { AddMiniApp } from "@farcaster/miniapp-node";

export default function AllowNotifications() {
  const { user } = useGlobalContext();

  const addFrame = useAddFrame();
  const sendNotification = useNotification();

  // Show drawer if user doesn't have token
  const shouldShowDrawer = user && (!user.token || user.token === "");
  console.log("Should show drawer:", shouldShowDrawer);
  const [open, setOpen] = useState(false);
  const [isAddingMiniApp, setIsAddingMiniApp] = useState(false);

  // Update open state when shouldShowDrawer changes
  useEffect(() => {
    if (shouldShowDrawer) {
      setOpen(true);
    }
  }, [shouldShowDrawer]);

  const handleAddMiniApp = useCallback(async () => {
    setIsAddingMiniApp(true);
    try {
      var token: any;

      const env = process.env.NEXT_PUBLIC_ENV;
      if (env !== "DEV" && !token) {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const result = await sdk.actions.addMiniApp();

      if (result.notificationDetails) {
        const res = await updateUserNotificationToken(
            result?.notificationDetails.token || Date.now().toString(),
            token
          );

      if (!res.ok) {
        toast.error(res.data.error || "Failed to save notification details");
        throw new Error(res.data.error || "Failed to save notification details");
      }
      }

      // Send test notification
      toast.success("Notifications enabled and miniapp added successfully.");
      
      setOpen(false);

    } catch (error: any) {
      console.error("Error adding MiniApp:", error);
      toast.error(error?.message || "Failed to enable notifications. Please try again.");
    } finally {
      setIsAddingMiniApp(false);
    }
  }, [addFrame, sendNotification]);

  if (shouldShowDrawer)
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-black">
          <DrawerHeader>
            <DrawerTitle className="text-center gradient-text text-2xl">
              Enable Notifications
            </DrawerTitle>
            <DrawerDescription className="text-center text-white/70">
              Stay updated on your conversations
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <IoMdNotifications className="text-blue-500 text-2xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-1">Get Real-time Updates</h3>
                <p className="text-sm text-white/70">
                  Receive instant notifications about room reminders, when speakers join your favorite conversations, or when important events happen in your rooms.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaBell className="text-green-500 text-xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-1">Never Miss Out</h3>
                <p className="text-sm text-white/70">
                  Be the first to know about scheduled rooms going live and join conversations with your favorite speakers.
                </p>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <button 
              onClick={handleAddMiniApp}
              disabled={isAddingMiniApp}
              className="w-full px-6 py-3 gradient-fire flex gap-2 items-center justify-center text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IoMdNotifications className="text-xl"/> 
              {isAddingMiniApp ? "Enabling..." : "Enable Notifications"}
            </button>
            <DrawerClose asChild>
              <button className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-md transition">
                Maybe Later
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
}
