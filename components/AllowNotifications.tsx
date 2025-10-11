'use client'
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "./UI/drawer";

export default function AllowNotifications() {
    const { user, handleAddFrame } = useGlobalContext();

    // Show drawer if user doesn't have token
    const shouldShowDrawer = user && (!user.token || user.token === "");
    console.log("Should show drawer:", shouldShowDrawer);
    const [open, setOpen] = useState(shouldShowDrawer);

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