'use client'
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "./UI/drawer";
import { useAddFrame, useNotification } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/miniapp-sdk";
import { fetchAPI } from "@/utils/serverActions";

export default function AllowNotifications() {
    const { user } = useGlobalContext();

     const addFrame = useAddFrame();
      const sendNotification = useNotification();

      // Show drawer if user doesn't have token
    const shouldShowDrawer = user && (!user.token || user.token === "");
    console.log("Should show drawer:", shouldShowDrawer);
    const [open, setOpen] = useState(false);

    // Update open state when shouldShowDrawer changes
    useEffect(() => {
        if (shouldShowDrawer) {
            setOpen(true);
        }
    }, [shouldShowDrawer]);

    const handleAddFrame = async () => {
        try {
          var token:any ;
          var result:any;
          const env = process.env.NEXT_PUBLIC_ENV;
          if (env !== "DEV" && !token) {
            token = ((await sdk.quickAuth.getToken()).token);
            result = await addFrame();
          }

          const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
          
          
            const res = await fetchAPI(`${URL}/api/users/protected/update`, {
              method: 'PATCH',
              body: {
                token: result?.token || Date.now(),
              },
              authToken: token,
            });

            console.log("Update user token response:", res);
    
            await sendNotification({
              title: "Notification Enabled",
              body: "Stay tuned for updates on your favorite speakers!",
            });
           
            // window.location.reload();
          
        } catch (error) {
          console.error("Error saving notification details:", error);
        } finally {
          setOpen(false);
        }
      };

    if(shouldShowDrawer)
    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="bg-black">
                <DrawerHeader className="text-center">
                    <DrawerTitle className="text-xl font-bold text-white mb-3">
                        Enable Notifications
                    </DrawerTitle>
                    <DrawerDescription className="text-white/70">
                        Stay updated with room reminders and important updates from your conversations.
                    </DrawerDescription>
                </DrawerHeader>
                
                <DrawerFooter>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddFrame}
                            className="flex-1 gradient-fire text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            Allow
                        </button>
                        
                        <button
                            onClick={() => setOpen(false)}
                            className="flex-1 bg-white/10 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 hover:bg-white/20 active:scale-95"
                        >
                            Cancel
                        </button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}