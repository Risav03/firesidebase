'use client'

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import Button from './UI/Button';

interface DeleteConfirmDrawerProps {
  roomName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export default function DeleteConfirmDrawer({ roomName, isOpen, onClose, onConfirm, isLoading }: DeleteConfirmDrawerProps) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent className="bg-black/95 backdrop-blur-lg text-white">
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold text-white">Delete Room</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4">
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-white font-medium mb-1">Are you sure you want to delete this room?</p>
                <p className="text-red-300 text-sm">
                  &ldquo;{roomName}&rdquo; will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t border-white/10">
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-1/2 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={onConfirm}
              disabled={isLoading}
              className="w-1/2 !bg-red-600 hover:!bg-red-700"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
