import { useState, useEffect, useRef, useCallback } from "react";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { FaEthereum } from "react-icons/fa";
import { BiSolidDollarCircle } from "react-icons/bi";
import { MdClose } from 'react-icons/md';
import { config } from "@/utils/providers/rainbow";
import { readContract, writeContract } from "@wagmi/core";
import { firebaseTipsAbi } from "@/utils/contract/abis/firebaseTipsAbi";
import { contractAdds } from "@/utils/contract/contractAdds";
import { useAccount, useSendCalls, useWriteContract } from "wagmi";
import { CustomConnect } from "./UI/connectButton";
import { toast } from "react-toastify";
import { getEthPrice } from "@/utils/commons";
import { ethers } from "ethers";
import { usdcAbi } from "@/utils/contract/abis/usdcabi";
import { RiLoader5Fill } from "react-icons/ri";
import { useHMSActions } from "@100mslive/react-sdk";
import { useSignTypedData } from "wagmi";
import { splitSignature } from "ethers/lib/utils";
import sdk from "@farcaster/miniapp-sdk";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { encodeFunctionData, numberToHex } from "viem";
import { erc20Abi } from "@/utils/contract/abis/erc20abi";
import Modal from "@/components/UI/Modal";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import {
  createBaseAccountSDK,
  getCryptoKeyAccount,
  base,
} from "@base-org/account";
import {
  fetchRoomParticipants,
  fetchRoomParticipantsByRole,
  sendChatMessage,
} from "@/utils/serverActions";

interface TippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

interface Participant {
  userId: string;
  username: string;
  pfp_url: string;
  customDomain?: string;
  wallet: string;
  status: string;
  role: string;
}

export default function TippingModal({
  isOpen,
  onClose,
  roomId,
}: TippingModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customTip, setCustomTip] = useState<string>("");
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Record<string, boolean>>(
    {
      host: false,
      "co-host": false,
      speaker: false,
      listener: false,
    }
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const batchSize = parseInt(process.env.NEXT_PUBLIC_BATCH_SIZE || "20");

  // Helper function to split arrays into batches of specified size
  const splitIntoBatches = (array: any[]) => {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  };

  const { user } = useGlobalContext();
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const { context, isFrameReady } = useMiniKit();

  const { address } = useAccount();
  const hmsActions = useHMSActions();

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const { sendCalls } = useSendCalls();

  useEffect(() => {
    if (isOpen) {
      setIsLoadingUsers(true);
      fetchRoomParticipants(roomId)
        .then((data) => {
          if (data.data.success) {
            const activeParticipants = data.data.data.participants.filter(
              (participant: Participant) => participant.status === "active"
            );

            setParticipants(activeParticipants);

            // Process participants to determine which roles are available
            const rolePresence: Record<string, boolean> = {
              host: false,
              "co-host": false,
              speaker: false,
              listener: false,
            };

            activeParticipants.forEach((participant: Participant) => {
              if (
                participant.role &&
                rolePresence.hasOwnProperty(participant.role)
              ) {
                rolePresence[participant.role] = true;
              }
            });

            setAvailableRoles(rolePresence);
          }
        })
        .catch((error) => console.error("Error fetching participants:", error))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [isOpen, roomId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const sendTipMessage = async (
    tipper: string,
    recipients: string,
    amount: number,
    currency: string,
    userFid: string
  ) => {
    const emoji = amount >= 100 ? "💸" : amount >= 25 ? "🎉" : "👍";
    const message = `${emoji} ${tipper} tipped ${recipients} $${amount} in ${currency}!`;

    // Send to HMS for real-time broadcast
    hmsActions.sendBroadcastMessage(message);

    // Store in Redis for persistence
    try {
      const { token } = await sdk.quickAuth.getToken();

      const response = await sendChatMessage(
        roomId,
        {
          message,
          userFid,
        },
        token
      );

      if (!response.data.success) {
        console.error(
          "Failed to store tip message in Redis:",
          response.data.error
        );
      }
    } catch (error) {
      console.error("Error saving tip message to Redis:", error);
    }
  };

  const handleETHTip = async () => {
    const env = process.env.NEXT_PUBLIC_ENV;

    var token: any = "";
    if (env !== "DEV") {
      token = (await sdk.quickAuth.getToken()).token;
    }
    try {
      setIsLoading(true);
      if (!selectedUsers.length && !selectedRoles.length) {
        toast.error("Please select users or roles to tip");
        return;
      }
      if (!selectedTip && !customTip) {
        toast.error("Please specify a tip amount");
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading("Processing your tip...");

      let usersToSend: any = [];

      if (selectedUsers.length > 0) {
        usersToSend = selectedUsers.map((user) => user.wallet);
      } else {
        for (const role of selectedRoles) {
          const response = await fetchRoomParticipantsByRole(roomId, role);

          if (response.data.success) {
            usersToSend.push(
              ...response.data.participants.map(
                (user: Participant) => user.wallet
              )
            );
          } else {
            console.error(
              "Failed to fetch participants by role:",
              response.data.error
            );
          }
        }
      }

      if (usersToSend.length === 0) {
        toast.error("No users found for tipping");
        return;
      }

      console.log("Users to send tip to:", usersToSend);

      const ethPrice = await getEthPrice();

      console.log("Current ETH price:", ethPrice);

      const tipAmount = selectedTip ? selectedTip : parseFloat(customTip);
      if (!tipAmount || isNaN(tipAmount)) {
        throw new Error("Invalid tip amount");
      }
      if (!ethPrice || isNaN(ethPrice)) {
        throw new Error("Invalid ETH price");
      }

      // Process in batches using environment variable
      const splitArr = splitIntoBatches(usersToSend);

      console.log("Split users into batches:", splitArr);
      console.log(Number(tipAmount / ethPrice))
      
      const sendingCalls = splitArr.map((batch) => {
        // Calculate ETH value per batch in decimal form
        const ethValuePerBatchDecimal = Number(tipAmount / (ethPrice * batch.length));
        // Convert to Wei (10^18) and ensure it's a valid integer by using Math.floor
        const ethValueInWei = BigInt(Math.floor(ethValuePerBatchDecimal * 1e18));

        console.log("ETH value per batch (decimal):", ethValuePerBatchDecimal);
        console.log("ETH value per batch (Wei):", ethValueInWei);

        return {
          to: contractAdds.tipping as `0x${string}`,
          value: ethValueInWei,
          data: encodeFunctionData({
            abi: firebaseTipsAbi,
            functionName: "distributeETH",
            args: [batch],
          }),
        };
      });

      console.log("Prepared sending calls:", sendingCalls);

      sendCalls({
          calls: sendingCalls,
        });


      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(
        `Successfully tipped $${selectedTip || customTip} to ${
          usersToSend.length
        } user(s)!`
      );

      // Send chat message
      const tipper = user?.username || "Someone";
      const recipients = selectedUsers.length
        ? selectedUsers.map((user) => user.username).join(", ")
        : selectedRoles
            .map((role) => (role === "host" ? role : `${role}s`))
            .join(", ");
      await sendTipMessage(
        tipper,
        recipients,
        selectedTip || parseFloat(customTip),
        "ETH",
        user?.fid || "unknown"
      );

      // Close modal and reset form
      onClose();
      setSelectedUsers([]);
      setSelectedRoles([]);
      setSelectedTip(null);
      setCustomTip("");
    } catch (error) {
      console.error("Error tipping users:", error);

      // Dismiss loading toast and show error
      toast.dismiss();
      toast.error("Failed to process tip. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUSDCTip = async () => {
    try {
      setIsLoading(true);
      if (!selectedUsers.length && !selectedRoles.length) {
        toast.error("Please select users or roles to tip");
        return;
      }
      if (!selectedTip && !customTip) {
        toast.error("Please specify a tip amount");
        return;
      }

      const loadingToast = toast.loading("Processing your tip...");

      let usersToSend: string[] = [];

      if (selectedUsers.length > 0) {
        usersToSend = selectedUsers.map((user) => user.wallet);
      } else {
        for (const role of selectedRoles) {
          const response = await fetchRoomParticipantsByRole(roomId, role);

          if (response.data.success) {
            usersToSend.push(
              ...response.data.participants.map(
                (user: Participant) => user.wallet
              )
            );
          } else {
            console.error(
              "Failed to fetch participants by role:",
              response.data.error
            );
          }
        }
      }

      if (usersToSend.length === 0) {
        toast.error("No users found for tipping");
        return;
      }

      const usdcAmount = (() => {
        const tipAmount = selectedTip
          ? selectedTip * usersToSend.length
          : parseFloat(String(Number(customTip) * usersToSend.length));
        if (!tipAmount || isNaN(tipAmount)) {
          throw new Error("Invalid tip amount");
        }
        return tipAmount * 1e6;
      })();

      const splitArr = splitIntoBatches(usersToSend);

      const approveCall = [
        {
          to: USDC_ADDRESS as `0x${string}`,
          value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [contractAdds.tipping, BigInt(usdcAmount)],
          }),
        },
      ];

      const remCals = splitArr.map((batch) => ({
        to: contractAdds.tipping as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: "distributeToken",
          args: [USDC_ADDRESS, batch, BigInt(Math.floor(usdcAmount / batch.length))],
        }),
      }));

      const sendingCalls = [...approveCall, ...remCals];

      console.log("Prepared sending calls:", sendingCalls);

      if (context?.client.clientFid !== 309857) {
        sendCalls({
          // @ts-ignore
          calls: sendingCalls,
        });

        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success(
          `Successfully tipped $${selectedTip || customTip} to ${
            usersToSend.length
          } user(s)!`
        );
      } else {
        const provider = createBaseAccountSDK({
          appName: "Fireside 100ms",
          appLogoUrl: "https://firesidebase.vercel.app/pfp.jpg",
          appChainIds: [base.constants.CHAIN_IDS.base],
        }).getProvider();

        const cryptoAccount = await getCryptoKeyAccount();
        const fromAddress = cryptoAccount?.account?.address;

        const result = await provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              version: "2.0.0",
              from: fromAddress,
              chainId: numberToHex(base.constants.CHAIN_IDS.base),
              atomicRequired: true,
              calls: sendingCalls,
            },
          ],
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const tipper = user?.username || "Someone";
      const recipients = selectedUsers.length
        ? selectedUsers.map((user) => user.username).join(", ")
        : selectedRoles
            .map((role) => (role === "host" ? role : `${role}s`))
            .join(", ");
      sendTipMessage(
        tipper,
        recipients,
        selectedTip || parseFloat(customTip),
        "USDC",
        user?.fid || "unknown"
      );

      onClose();
      setSelectedUsers([]);
      setSelectedRoles([]);
      setSelectedTip(null);
      setCustomTip("");
    } catch (error) {
      console.error("Error tipping users:", error);
      toast.dismiss();
      toast.error("Failed to process tip. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelection = (role: string) => {
    // Skip if the role has no participants
    if (!availableRoles[role]) {
      return;
    }

    if (selectedRoles.includes(role)) {
      setSelectedRoles((prev) => prev.filter((r) => r !== role));
    } else {
      setSelectedRoles((prev) => [...prev, role]);
    }
    setSelectedUsers([]); // Clear user selection when roles are selected
  };

  const handleUserSelection = (user: any) => {
    if (selectedUsers.some((u) => u.userId === user.userId)) {
      setSelectedUsers((prev) => prev.filter((u) => u.userId !== user.userId));
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setSelectedRoles([]); // Clear role selection when users are selected
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent 
        className="bg-black/95 backdrop-blur-lg text-white border-fireside-orange/30 max-h-[95vh] flex flex-col"
      >
        
        <DrawerHeader className="flex-shrink-0 border-b border-fireside-orange/30 sticky top-0 bg-black/95 backdrop-blur-lg z-10">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-2xl font-bold text-white">
              Send a Tip
            </DrawerTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Close"
            >
              <MdClose size={24} />
            </button>
          </div>
        </DrawerHeader>

        {false ? (
          <div className="w-full flex items-center justify-center p-6">
            <CustomConnect />
          </div>
        ) : (
          <>
            {/* Main Content Area */}
            <div className="px-4 flex-1 overflow-y-auto">
              {/* User Selection */}
              <div className="mb-6">
                <label className="block text-lg font-bold text-orange-400 mb-3">
                  Select multiple users
                </label>
                <div ref={dropdownRef} className="relative">
                  <div
                    className="bg-white/10 border border-orange-500/50 rounded-lg text-white p-3 cursor-pointer hover:bg-white/20 transition-colors"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                  >
                    {selectedUsers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                          <div
                            key={user.userId}
                            className="flex items-center bg-orange-600 rounded-full px-3 py-1"
                          >
                            <img
                              src={user.pfp_url || "/default-avatar.png"}
                              alt={user.username}
                              className="w-5 h-5 rounded-full mr-2"
                            />
                            <span className="text-sm font-medium">
                              {user.username}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>Choose users</span>
                    )}
                  </div>

                  {dropdownOpen && (
                    <div className="absolute top-full left-0 w-full bg-black border border-orange-500/50 rounded-lg max-h-60 overflow-y-auto mt-1 z-10">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center p-4">
                          <RiLoader5Fill className="animate-spin text-white text-2xl" />
                        </div>
                      ) : (
                        <>
                          <div className="p-3">
                            <input
                              onPointerDown={(e) => e.stopPropagation()}
                              type="text"
                              placeholder="Search users..."
                              className="w-full bg-white/10 text-white p-2 rounded-lg border border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors"
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          {participants
                            .filter((participant) =>
                              participant.username
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())
                            )
                            .map((participant) => (
                              <div
                                key={participant.userId}
                                className={`flex items-center p-3 cursor-pointer hover:bg-white/20 transition-colors ${
                                  selectedUsers.some(
                                    (user) => user.userId === participant.userId
                                  )
                                    ? "bg-orange-600/30"
                                    : ""
                                }`}
                                onClick={() => handleUserSelection(participant)}
                              >
                                <img
                                  src={
                                    participant.pfp_url || "/default-avatar.png"
                                  }
                                  alt={participant.username}
                                  className="w-10 h-10 rounded-full mr-3"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {participant.username}
                                  </p>
                                  <p className="text-xs text-white/60">
                                    {participant.role || "No domain"}
                                  </p>
                                </div>
                                {selectedUsers.some(
                                  (user) => user.userId === participant.userId
                                ) && (
                                  <svg
                                    className="w-5 h-5 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tip Amount Selection */}
              <div className="mb-6 w-full">
                <label className="text-lg block font-bold text-orange-400 mb-3">
                  Select Tip Amount
                </label>
                <div className="flex gap-2 w-full">
                  {[0.1, 0.5, 1].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        setSelectedTip(amount);
                        setCustomTip("");
                      }}
                      className={`px-4 py-2 rounded-lg text-white font-semibold transition-colors flex-1 ${
                        selectedTip === amount
                          ? "gradient-fire border-white border-2"
                          : "bg-white/10 border-transparent hover:bg-white/20"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <label className="text-md block font-semibold text-white/70 mt-4 mb-2">
                  Add Custom Tip Amount ($)
                </label>

                <input
                  onPointerDown={(e) => e.stopPropagation()}
                  type="number"
                  placeholder="Custom amount"
                  value={customTip}
                  onChange={(e) => {
                    setCustomTip(e.target.value);
                    setSelectedTip(null);
                  }}
                  className="px-4 py-2 rounded-lg text-white bg-white/10 border w-full border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <DrawerFooter className="border-fireside-orange/30 flex-shrink-0 bottom-0 bg-black/95 backdrop-blur-lg">
              <div className="flex gap-3">
                <button
                  onClick={() => handleETHTip()}
                  disabled={isLoading}
                  className={`flex-1 text-white bg-indigo-400 text-nowrap font-semibold py-3 px-4 rounded-lg transition-colors border border-white/20 hover:border-white/40 ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span className="flex gap-2 items-center justify-center text-nowrap">
                    {isLoading ? (
                      <RiLoader5Fill className="animate-spin" />
                    ) : (
                      <FaEthereum />
                    )}
                    Tip in ETH
                  </span>
                </button>
                <button
                  onClick={() => handleUSDCTip()}
                  disabled={isLoading}
                  className={`flex-1 gradient-fire text-white font-semibold text-nowrap py-3 px-4 rounded-lg transition-colors disabled:opacity-50 ${
                    isLoading ? "cursor-not-allowed" : ""
                  }`}
                >
                  <span className="flex gap-2 items-center justify-center text-nowrap">
                    {isLoading ? (
                      <RiLoader5Fill className="animate-spin" />
                    ) : (
                      <BiSolidDollarCircle />
                    )}
                    Tip in USDC
                  </span>
                </button>
              </div>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
