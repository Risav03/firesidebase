import { useState, useEffect, useRef } from "react";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { FaEthereum } from "react-icons/fa";
import { BiSolidDollarCircle } from "react-icons/bi";
import { config } from "@/utils/providers/rainbow";
import { readContract, writeContract } from "@wagmi/core";
import { firebaseTipsAbi } from "@/utils/contract/abis/firebaseTipsAbi";
import { contractAdds } from "@/utils/contract/contractAdds";
import { useAccount, useWriteContract } from "wagmi";
import { CustomConnect } from "./UI/connectButton";
import toast from "react-hot-toast";
import { getEthPrice } from "@/utils/commons";
import { ethers } from "ethers";
import { usdcAbi } from "@/utils/contract/abis/usdcabi";
import { RiLoader5Fill } from "react-icons/ri";
import { useHMSActions } from "@100mslive/react-sdk";
import { useSignTypedData } from 'wagmi'
import { splitSignature } from "ethers/lib/utils";
import sdk from "@farcaster/miniapp-sdk";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useGlobalContext();
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()

  const { address } = useAccount();
  const hmsActions = useHMSActions();

  useEffect(() => {
    if (isOpen) {
      setIsLoadingUsers(true);
      fetch(`/api/rooms/${roomId}/participants`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            const activeParticipants = data.participants.filter(
              (participant: Participant) => participant.status === "active"
            );
            setParticipants(activeParticipants);
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

  const sendTipMessage = async (tipper: string, recipients: string, amount: number, currency: string, userFid: string) => {
    const emoji = amount >= 100 ? "💸" : amount >= 25 ? "🎉" : "👍";
    const message = `${emoji} ${tipper} tipped ${recipients} $${amount} in ${currency}!`;

    // Send to HMS for real-time broadcast
    hmsActions.sendBroadcastMessage(message);

    // Store in Redis for persistence
    try {
      const {token} = await sdk.quickAuth.getToken();
      const response = await fetch(`/api/protected/chat/${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          userFid,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error("Failed to store tip message in Redis:", data.error);
      }
    } catch (error) {
      console.error("Error saving tip message to Redis:", error);
    }
  };

  const handleETHTip = async () => {
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
        for (const role in selectedRoles) {
          const res = await fetch(`/api/rooms/${roomId}/participants-by-role`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role: selectedRoles[role],
            }),
          });

          const data = await res.json();
          if (data.success) {
            usersToSend.push(
              ...data.participants.map((user: Participant) => user.wallet)
            );
          } else {
            console.error("Failed to fetch participants by role:", data.error);
          }
        }
      }

      if (usersToSend.length === 0) {
        toast.error("No users found for tipping");
        return;
      }

      const ethPrice = await getEthPrice();

      const cryptoAmount = (() => {
        const tipAmount = selectedTip ? selectedTip : parseFloat(customTip);
        if (!tipAmount || isNaN(tipAmount)) {
          throw new Error("Invalid tip amount");
        }
        if (!ethPrice || isNaN(ethPrice)) {
          throw new Error("Invalid ETH price");
        }
        return Number((tipAmount / ethPrice).toFixed(6));
      })();

      const res = await writeContract(config, {
        abi: firebaseTipsAbi,
        address: contractAdds.tipping as `0x${string}`,
        functionName: "distributeETH",
        args: [usersToSend],
        value: BigInt(cryptoAmount * 1e18),
      });

      console.log("Transaction successful:", res);

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(
        `Successfully tipped $${selectedTip || customTip} to ${usersToSend.length} user(s)!`
      );

      // Send chat message
      const tipper = user?.username || "Someone";
      const recipients = selectedUsers.length
        ? selectedUsers.map((user) => user.username).join(", ")
        : selectedRoles.map((role) => (role === "host" ? role : `${role}s`)).join(", ");
      await sendTipMessage(tipper, recipients, selectedTip || parseFloat(customTip), "ETH", user?.fid || "unknown");

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
          const res = await fetch(`/api/rooms/${roomId}/participants-by-role`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role,
            }),
          });

          const data = await res.json();
          if (data.success) {
            usersToSend.push(
              ...data.participants.map((user: Participant) => user.wallet)
            );
          } else {
            console.error("Failed to fetch participants by role:", data.error);
          }
        }
      }

      if (usersToSend.length === 0) {
        toast.error("No users found for tipping");
        return;
      }

      const usdcAmount = (() => {
        const tipAmount = selectedTip ? selectedTip : parseFloat(customTip);
        if (!tipAmount || isNaN(tipAmount)) {
          throw new Error("Invalid tip amount");
        }
        return BigInt(tipAmount * 1e6);
      })();

      const provider = new ethers.providers.JsonRpcProvider(
        "https://base-mainnet.g.alchemy.com/v2/CA4eh0FjTxMenSW3QxTpJ7D-vWMSHVjq"
      );

      const contract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
      const nonce = BigInt(await contract.nonces(address));


      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // +1 hour

      const domain = {
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: USDC_ADDRESS,
        primaryType: "Permit",
      } as const;

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      } as const;

      const values = {
        owner: address as `0x${string}`,
        spender: contractAdds.tipping as `0x${string}`,
        value: usdcAmount,
        nonce,
        deadline,
      };

      const signature = await signTypedDataAsync({
        domain,
        primaryType: "Permit",
        types,
        message: values,
      });

      const { v, r, s } = splitSignature(signature);

      const res = await writeContract(config, {
        abi: firebaseTipsAbi,
        address: contractAdds.tipping as `0x${string}`,
        functionName: "distributeTokenWithPermit",
        args: [
          USDC_ADDRESS,
          usersToSend,
          usdcAmount, // must be uint256 with 6 decimals
          deadline,
          v,
          r,
          s,
        ],
      });

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(
        `Successfully tipped $${selectedTip || customTip} to ${usersToSend.length} user(s)!`
      );

      const tipper = user?.username || "Someone";
      const recipients = selectedUsers.length
        ? selectedUsers.map((user) => user.username).join(", ")
        : selectedRoles.map((role) => (role === "host" ? role : `${role}s`)).join(", ");
      sendTipMessage(tipper, recipients, selectedTip || parseFloat(customTip), "USDC", user?.fid || "unknown");

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        {!address ? (
          <div className="w-full flex items-center justify-center">
            {" "}
            <CustomConnect />{" "}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Send a Tip</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select multiple roles
              </label>
              <div className="flex space-x-2">
                {["host", "co-host", "speaker", "listener"].map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelection(role)}
                    className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                      selectedRoles.includes(role)
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-600 hover:bg-gray-700"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full flex items-center justify-center text-white">
              {" "}
              -- OR --{" "}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select multiple users
              </label>
              <div ref={dropdownRef} className="relative">
                <div
                  className="bg-gray-700 border border-gray-600 rounded-md text-white p-2 cursor-pointer"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  {selectedUsers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((user) => (
                        <div
                          key={user.userId}
                          className="flex items-center bg-gray-600 rounded-md px-2 py-1"
                        >
                          <img
                            src={user.pfp_url || "/default-avatar.png"}
                            alt={user.username}
                            className="w-6 h-6 rounded-full border border-gray-600 mr-2"
                          />
                          <span>{user.username}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>Choose users</span>
                  )}
                </div>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded-md max-h-60 overflow-y-auto">
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-center p-4">
                        <RiLoader5Fill className="animate-spin text-white text-2xl" />
                      </div>
                    ) : (
                      <>
                        <div className="p-2">
                          <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full bg-gray-600 text-white p-2 rounded-md border border-gray-500 focus:outline-none"
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
                              className={`flex items-center p-2 cursor-pointer hover:bg-gray-600 ${
                                selectedUsers.some(
                                  (user) => user.userId === participant.userId
                                )
                                  ? "bg-gray-600"
                                  : ""
                              }`}
                              onClick={() => handleUserSelection(participant)}
                            >
                              <img
                                src={participant.pfp_url || "/default-avatar.png"}
                                alt={participant.username}
                                className="w-10 h-10 rounded-full border border-gray-600 mr-3"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  {participant.username}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {participant.customDomain || "No domain"}
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

            <div className="mb-4 w-full">
              <label className="text-sm block font-medium text-gray-300 mb-2">
                Select Tip Amount
              </label>
              <div className="flex space-x-2 w-full">
                {[10, 25, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedTip(amount);
                      setCustomTip("");
                    }}
                    className={`px-4 py-2 rounded-md text-white font-medium transition-colors w-1/3 ${
                      selectedTip === amount
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-600 hover:bg-gray-700"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <label className="text-sm block font-medium text-gray-300 mt-4 mb-2">
                Add Custom Tip Amount ($)
              </label>

              <input
                type="number"
                placeholder="Custom"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  setSelectedTip(null);
                }}
                className="px-4 py-2 rounded-md text-white bg-gray-600 border w-full border-gray-500 focus:outline-none"
              />
            </div>

            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => handleETHTip()}
                disabled={isLoading}
                className={`flex-1 text-white bg-indigo-400 hover:bg-indigo-500 font-medium py-2 px-4 rounded-md transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="flex gap-2 items-center justify-center">
                  <FaEthereum />
                  Tip in ETH
                </span>
              </button>
              {/* <button
                onClick={() => handleUSDCTip()}
                disabled={isLoading}
                className={`flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="flex gap-2 items-center justify-center">
                  <BiSolidDollarCircle />
                  Tip in USDC
                </span>
              </button> */}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
