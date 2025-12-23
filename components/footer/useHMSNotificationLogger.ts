// "use client";

// import { useEffect } from "react";
// import { useHMSNotifications, HMSNotificationTypes } from "@100mslive/react-sdk";

// export function useHMSNotificationLogger(localPeer: any, isLocalAudioEnabled: boolean) {
//   const notification = useHMSNotifications();

//   useEffect(() => {
//     if (notification) {
//       console.log("[HMS Event]", {
//         type: notification.type,
//         timestamp: new Date().toISOString(),
//         data: notification.data,
//         localPeer: localPeer?.name,
//         localPeerId: localPeer?.id,
//         localRole: localPeer?.roleName,
//         isLocalAudioEnabled,
//       });
//     }
//   }, [notification, localPeer, isLocalAudioEnabled]);
// }
