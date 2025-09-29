"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { RiLoader5Fill } from "react-icons/ri";
import { FaEthereum } from "react-icons/fa";
import { BiSolidDollarCircle } from "react-icons/bi";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from "@/components/UI/drawer";
import { useHMSStore, selectPeers, useHMSActions } from "@100mslive/react-sdk";
import sdk from "@farcaster/miniapp-sdk";
import { createSponsorship, fetchSponsorshipStatus, withdrawSponsorshipRequest, fetchLiveParticipants, sendChatMessage, activateSponsorship } from "@/utils/serverActions";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useNewSponsorEvent } from "@/utils/events";
import Modal from "@/components/UI/Modal";
import { useAccount, useSendCalls, useWriteContract, useSignTypedData } from "wagmi";
import { encodeFunctionData, numberToHex } from "viem";
import { erc20Abi } from "@/utils/contract/abis/erc20abi";
import { firebaseAdsAbi } from "@/utils/contract/abis/firebaseAdsAbi";
import { contractAdds } from "@/utils/contract/contractAdds";
import { getEthPrice } from "@/utils/commons";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import {
  createBaseAccountSDK,
  getCryptoKeyAccount,
  base,
} from "@base-org/account";

interface SponsorDrawerProps {
  isOpen: boolean;
  onClose: (sponsorshipData?: {
    id: string;
    sponsor: string;
    amount: number;
    currency: string;
    roomId: string;
    endsAt: string;
    startedAt: string;
  }) => void;
  roomId: string;
}

interface Participant {
  id: string;
  name: string;
  user_id?: string;
  metadata?: string;
  role: string;
  joined_at: string;
  left_at?: string;
}

export default function SponsorDrawer({
  isOpen,
  onClose,
  roomId,
}: SponsorDrawerProps) {
  const { user } = useGlobalContext();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sponsorDuration, setSponsorDuration] = useState<number>(5 * 60); // 5 minutes in seconds by default
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingSponsorship, setPendingSponsorship] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [processingTx, setProcessingTx] = useState(false);
  
  // Get all peers in the room
  const peers = useHMSStore(selectPeers);
  const peerCount = peers.length;
  
  // Tipping related
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { context, isFrameReady } = useMiniKit();
  const { address } = useAccount();
  const hmsActions = useHMSActions();
  const { sendCalls, isSuccess, status } = useSendCalls();
  const [transactionToastId, setTransactionToastId] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<{
    sponsor: string;
    amount: number;
    currency: string;
    userFid: string;
  } | null>(null);
  const batchSize = parseInt(process.env.NEXT_PUBLIC_BATCH_SIZE || "20");
  const { notifyNewSponsor } = useNewSponsorEvent();
  
  // Check if user has a pending sponsorship request
  useEffect(() => {
    const checkSponsorshipStatus = async () => {
      if (user?._id && isOpen) {
        setLoadingStatus(true);
        try {
          const env = process.env.NEXT_PUBLIC_ENV;
          let token: any = null;
          if (env !== "DEV") {
            token = (await sdk.quickAuth.getToken()).token;
          }
          
          const result = await fetchSponsorshipStatus(user._id, roomId, token);
          
          if (result.ok && result.data) {
            console.log("Fetched sponsorship status:", result.data);
            setPendingSponsorship(result.data.data);
          } else {
            setPendingSponsorship(null);
          }
        } catch (error) {
          console.error("Error fetching sponsorship status:", error);
          setPendingSponsorship(null);
        } finally {
          setLoadingStatus(false);
        }
      }
    };
    
    checkSponsorshipStatus();
  }, [user, isOpen]);

  const maxDuration = 15 * 60; // 15 minutes in seconds
  
  // Calculate slider percentage for styling
  const sliderPercentage = (sponsorDuration / maxDuration) * 100;

  // Helper function to format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} sec`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} min${mins !== 1 ? 's' : ''} ${secs > 0 ? `${secs} sec` : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} min${mins !== 1 ? 's' : ''}` : ''}`;
    }
  };

  // Calculate estimated price based on duration
  const calculatePrice = (durationInSeconds: number) => {
    // Base rate: $1 per minute
    const baseRate = 0.1;
    const durationInMinutes = durationInSeconds / 60;
    
    // Factor in peer count - each additional peer increases value by 5%
    // Base is 1x for 1-5 peers, then 5% more for each additional peer up to a 50% increase
    const peerFactor = Math.ceil(peerCount / 10);
    
    // Calculate price with all factors
    const price = baseRate * durationInMinutes * peerFactor;
    
    // Round to 2 decimal places
    return Math.ceil(price * 100) / 100;
  };

  // Helper function to split arrays into batches of specified size
  const splitIntoBatches = (array: any[]) => {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  };

  // Send a chat message about the sponsorship payment
  const sendSponsorMessage = async (
    sponsor: string,
    amount: number,
    currency: string,
    userFid: string
  ) => {
    const emoji = amount >= 100 ? "💸" : amount >= 25 ? "🎉" : "👍";
    const message = `${emoji} ${sponsor} sponsored this room for $${amount} in ${currency}!`;

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
          "Failed to store sponsorship message in Redis:",
          response.data.error
        );
      }
    } catch (error) {
      console.error("Error saving sponsorship message to Redis:", error);
    }
  };
  
  // Watch for transaction success/failure
  useEffect(() => {
    // When transaction succeeds
    if (isSuccess && transactionToastId && transactionData) {
      // Process successful transaction
      const processSuccess = async () => {
        try {
          // Activate the sponsorship
          if (pendingSponsorship?.id) {
            const env = process.env.NEXT_PUBLIC_ENV;
            let token: any = null;
            if (env !== "DEV") {
              token = (await sdk.quickAuth.getToken()).token;
            }
            
            const activateResult = await activateSponsorship(pendingSponsorship.id, token);
            
            if (!activateResult.ok) {
              console.error("Failed to activate sponsorship:", activateResult.data);
              // Continue anyway since payment was successful
            } else {
              // Extract sponsorship data
              const startedAt = activateResult.data?.startedAt || new Date().toISOString();
              const endsAt = activateResult.data?.endsAt || new Date().toISOString();
              
              // Notify about new sponsorship using event system
              notifyNewSponsor(transactionData.sponsor, pendingSponsorship.id);
              
              // Send the sponsorship data to the parent component through onClose
              onClose({
                id: pendingSponsorship.id,
                sponsor: transactionData.sponsor,
                amount: transactionData.amount,
                currency: transactionData.currency,
                roomId,
                endsAt,
                startedAt
              });
            }
          }
          
          // Dismiss loading toast and show success
          toast.dismiss(transactionToastId);
          toast.success("Sponsorship payment completed successfully!");
          
          // Close modals and reset state if not already done by onClose
          setIsTransactionModalOpen(false);
          if (!pendingSponsorship?.id) {
            onClose();
          }
          setProcessingTx(false);
          setTransactionToastId(null);
          setTransactionData(null);
        } catch (error) {
          console.error("Error in post-transaction processing:", error);
          
          // Still show success since the payment was successful
          toast.dismiss(transactionToastId);
          toast.success("Payment successful, but there was an issue activating the sponsorship.");
          
          // Close modals and reset state
          setIsTransactionModalOpen(false);
          onClose();
          setProcessingTx(false);
          setTransactionToastId(null);
          setTransactionData(null);
        }
      };
      
      processSuccess();
    } 
    // When transaction fails (status === 'error')
    else if (status === 'error' && transactionToastId) {
      toast.dismiss(transactionToastId);
      toast.error("Transaction failed. Please try again.");
      setProcessingTx(false);
      setTransactionToastId(null);
      setTransactionData(null);
    }
  }, [isSuccess, status, transactionToastId, transactionData, onClose, pendingSponsorship?.id, roomId, notifyNewSponsor]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      toast.error("Please upload a banner image");
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading("Processing your sponsorship request...");

    try {
      // Since selectedImage is already a base64 string, extract the base64 data
      // We'll use the base64 string directly as the backend expects a string
      const env = process.env.NEXT_PUBLIC_ENV;
      
      // Extract just the base64 part without the data URL prefix
      const base64Data = selectedImage.split(',')[1];
      
      console.log("Using base64 image data, length:", base64Data.length);
      
      let token:any = null;
      if(env !== "DEV"){
        token = (await sdk.quickAuth.getToken()).token;
      }
      
      // Use the server action with the base64 string
      const result = await createSponsorship({
        roomId,
        duration: sponsorDuration,
        imageBuffer: base64Data, // send as base64 string
      }, token);

      console.log("Sponsorship creation result:", result);
      
      if (result.ok) {
        toast.dismiss(loadingToast);
        toast.success("Sponsorship request sent to host!");
        onClose();
      } else {
        toast.dismiss(loadingToast);
        toast.error(`Failed to create sponsorship: ${result.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error submitting sponsorship request:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to submit sponsorship request. Make sure image size is below 5mb.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleWithdrawRequest = async () => {
    if (!pendingSponsorship?.id) return;
    
    setIsLoading(true);
    const loadingToast = toast.loading("Withdrawing your sponsorship request...");
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token:any = null;
      if(env !== "DEV"){
        token = (await sdk.quickAuth.getToken()).token;
      }

      const res = await withdrawSponsorshipRequest(pendingSponsorship.id, token);

      console.log("Withdraw sponsorship result:", res);
      
      toast.dismiss(loadingToast);
      toast.success("Sponsorship request withdrawn");
      setPendingSponsorship(null);
    } catch (error) {
      console.error("Error withdrawing sponsorship request:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to withdraw sponsorship request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTransaction = async () => {
    if (!pendingSponsorship?.id) return;
    
    // Show transaction modal with price and payment options
    onClose()
    setIsTransactionModalOpen(true);
  };
  
  const handleETHPayment = async () => {
    if (!pendingSponsorship?.id) return;
    
    setProcessingTx(true);
    const loadingToastId = toast.loading("Processing transaction...");
    setTransactionToastId(loadingToastId);
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }
      
      // Get participants from the API
      const response = await fetchLiveParticipants(roomId);
      
      if (!response.ok || !response.data.success) {
        throw new Error("Failed to fetch room participants");
      }
      
      // Parse metadata and extract wallets
      const participants = response.data.data.peers;
      
      // Process participants to extract wallet addresses
      const wallets = participants
        .map((peer: Participant) => {
          if (!peer.metadata) return null;
          try {
            const metadata = JSON.parse(peer.metadata);
            return metadata.wallet || null;
          } catch (err) {
            console.error("Error parsing metadata:", err);
            return null;
          }
        })
        .filter((wallet: string | null): wallet is string => wallet !== null && wallet !== '');
      
      if (wallets.length === 0) {
        throw new Error("No valid wallet addresses found for distribution");
      }
      
      console.log("Wallets for distribution:", wallets);
      
      // Calculate price using the calculatePrice function
      const sponsorPrice = calculatePrice(pendingSponsorship.duration || 300);
      
      // Get ETH price for conversion
      const ethPrice = await getEthPrice();
      console.log("Current ETH price:", ethPrice);
      
      if (!ethPrice || isNaN(ethPrice)) {
        throw new Error("Invalid ETH price");
      }
      
      // Process in batches
      const splitArr = splitIntoBatches(wallets);
      console.log("Split wallets into batches:", splitArr);
      
      const sendingCalls = splitArr.map((batch) => {
        // Calculate ETH value per batch in decimal form
        const ethValuePerBatchDecimal = Number(sponsorPrice / (ethPrice * batch.length));
        // Convert to Wei (10^18) and ensure it's a valid integer by using Math.floor
        const ethValueInWei = BigInt(Math.floor(ethValuePerBatchDecimal * 1e18));

        console.log("ETH value per batch (decimal):", ethValuePerBatchDecimal);
        console.log("ETH value per batch (Wei):", ethValueInWei);

        return {
          to: contractAdds.sponsor as `0x${string}`,
          value: ethValueInWei,
          data: encodeFunctionData({
            abi: firebaseAdsAbi,
            functionName: "distributeETH",
            args: [batch],
          }),
        };
      });

      console.log("Prepared sending calls:", sendingCalls);

      // Store transaction data for use in the success handler
      setTransactionData({
        sponsor: user?.username || "Someone",
        amount: sponsorPrice,
        currency: "ETH",
        userFid: user?.fid || "unknown"
      });

      // Submit transaction
      sendCalls({
        calls: sendingCalls,
      });
      
      // Note: Success handling is moved to the useEffect watching for isSuccess
      
    } catch (error) {
      console.error("Error processing ETH transaction:", error);
      toast.dismiss(loadingToastId);
      toast.error("Transaction failed. Please try again.");
      setProcessingTx(false);
      setTransactionToastId(null);
      setTransactionData(null);
    }
  };
  
  const handleUSDCPayment = async () => {
    if (!pendingSponsorship?.id) return;
    
    setProcessingTx(true);
    const loadingToastId = toast.loading("Processing USDC transaction...");
    setTransactionToastId(loadingToastId);
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }
      
      // Get participants from the API
      const response = await fetchLiveParticipants(roomId);
      
      if (!response.ok || !response.data.success) {
        throw new Error("Failed to fetch room participants");
      }
      
      // Parse metadata and extract wallets
      const participants = response.data.data.peers;
      
      // Process participants to extract wallet addresses
      const wallets = participants
        .map((peer: Participant) => {
          if (!peer.metadata) return null;
          try {
            const metadata = JSON.parse(peer.metadata);
            return metadata.wallet || null;
          } catch (err) {
            console.error("Error parsing metadata:", err);
            return null;
          }
        })
        .filter((wallet: string | null): wallet is string => wallet !== null && wallet !== '');
      
      if (wallets.length === 0) {
        throw new Error("No valid wallet addresses found for distribution");
      }
      
      console.log("Wallets for distribution:", wallets);
      
      // Calculate price using the calculatePrice function
      const sponsorPrice = calculatePrice(pendingSponsorship.duration || 300);
      
      // Calculate USDC amount (price in USD * 10^6 for USDC decimals)
      const usdcAmount = BigInt(Math.floor(sponsorPrice * 1e6));
      
      // Process in batches
      const splitArr = splitIntoBatches(wallets);
      
      const approveCall = [
        {
          to: USDC_ADDRESS as `0x${string}`,
          value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [contractAdds.sponsor, usdcAmount],
          }),
        },
      ];

      const remCals = splitArr.map((batch) => ({
        to: contractAdds.sponsor as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
        data: encodeFunctionData({
          abi: firebaseAdsAbi,
          functionName: "distributeToken",
          args: [USDC_ADDRESS, batch, BigInt(Math.floor(Number(usdcAmount) / batch.length))],
        }),
      }));

      const sendingCalls = [...approveCall, ...remCals];

      console.log("Prepared sending calls:", sendingCalls);

      // Store transaction data for use in the success handler
      setTransactionData({
        sponsor: user?.username || "Someone",
        amount: sponsorPrice,
        currency: "USDC",
        userFid: user?.fid || "unknown"
      });

      if (context?.client.clientFid !== 309857) {
        // Use Wagmi's sendCalls for regular Ethereum wallets
        sendCalls({
          // @ts-ignore
          calls: sendingCalls,
        });
      } else {
        // Use Base Account SDK for specific wallets
        const provider = createBaseAccountSDK({
          appName: "Fireside",
          appLogoUrl: "https://fireside-interface.vercel.app/pfp.png",
          appChainIds: [base.constants.CHAIN_IDS.base],
        }).getProvider();

        const cryptoAccount = await getCryptoKeyAccount();
        const fromAddress = cryptoAccount?.account?.address;

        try {
          const res:any = await provider.request({
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

          await res.wait();
          
          // Activate the sponsorship
          if (pendingSponsorship?.id && transactionData) {
            try {
              const activateResult = await activateSponsorship(pendingSponsorship.id, token);
              
              if (!activateResult.ok) {
                console.error("Failed to activate sponsorship:", activateResult.data);
                // Continue anyway since payment was successful
              } else {
                // Extract sponsorship data
                const startedAt = activateResult.data?.startedAt || new Date().toISOString();
                const endsAt = activateResult.data?.endsAt || new Date().toISOString();
                
                // Notify about new sponsorship using event system
                notifyNewSponsor(transactionData.sponsor, pendingSponsorship.id);
                
                // Send the sponsorship data to the parent component through onClose
                onClose({
                  id: pendingSponsorship.id,
                  sponsor: transactionData.sponsor,
                  amount: transactionData.amount,
                  currency: transactionData.currency,
                  roomId,
                  endsAt,
                  startedAt
                });
              }
            } catch (activateError) {
              console.error("Error activating sponsorship:", activateError);
              // Continue anyway since payment was successful
            }
          }
          
          // Send chat message
          try {
            await sendSponsorMessage(
              user?.username || "Someone",
              sponsorPrice,
              "USDC",
              user?.fid || "unknown"
            );
          } catch (chatError) {
            console.error("Error sending sponsorship message:", chatError);
            // Continue anyway since payment was successful
          }

          // Show success message and close modal for Base Account SDK
          toast.dismiss(loadingToastId);
          toast.success("Sponsorship payment completed successfully!");
          setIsTransactionModalOpen(false);
          
          // If activateResult has data, use it; otherwise, create defaults
          const startedAt = new Date().toISOString();
          const endsAt = new Date(Date.now() + (pendingSponsorship?.duration || 300) * 1000).toISOString();
          
          // Close with sponsorship data
          if (transactionData && pendingSponsorship?.id) {
            onClose({
              id: pendingSponsorship.id,
              sponsor: transactionData.sponsor,
              amount: transactionData.amount,
              currency: transactionData.currency,
              roomId,
              endsAt,
              startedAt
            });
          } else {
            onClose();
          }
          
          setProcessingTx(false);
          setTransactionToastId(null);
          setTransactionData(null);
        } catch (error) {
          throw error; // Re-throw to be caught by the outer catch block
        }
      }
      
      // Note: For non-Base Account transactions, success handling is moved to the useEffect watching for isSuccess
      
    } catch (error) {
      console.error("Error processing USDC transaction:", error);
      toast.dismiss(loadingToastId);
      toast.error("Transaction failed. Please try again.");
      setProcessingTx(false);
      setTransactionToastId(null);
      setTransactionData(null);
    }
  };
  
  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="bg-black/50 backdrop-blur-2xl text-white border-t border-fireside-orange/30 focus:outline-none">
          <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-fireside-orange/30"></div>
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-bold text-white">Sponsor This Room</DrawerTitle>
          </DrawerHeader>
        
        {loadingStatus ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RiLoader5Fill className="w-12 h-12 text-fireside-orange animate-spin" />
            <p className="mt-4 text-gray-300">Checking sponsorship status...</p>
          </div>
        ) : pendingSponsorship ? (
          <div className="px-4 pb-6">
            <div className="mb-6 p-4 bg-black/40 border border-fireside-orange/30 rounded-lg">
              <div className="text-center mb-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
                  pendingSponsorship.status === 'approved' 
                    ? 'bg-green-500/20' 
                    : 'bg-fireside-orange/20'
                } mb-2`}>
                  {pendingSponsorship.status === 'approved' ? (
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-fireside-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {pendingSponsorship.status === 'approved' 
                    ? 'Sponsorship Approved' 
                    : 'Sponsorship Request Pending'}
                </h3>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Your banner:</p>
                <div className="rounded-lg overflow-hidden border border-fireside-orange/30 aspect-[3/1]">
                  {pendingSponsorship.imageUrl ? (
                    <img 
                      src={pendingSponsorship.imageUrl} 
                      alt="Sponsorship banner" 
                      className="w-full object-cover aspect-[3/1]"
                    />
                  ) : (
                    <div className="w-full h-32 bg-black/40 flex items-center justify-center">
                      <p className="text-gray-400 text-sm">Image not available</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-semibold ${
                    pendingSponsorship.status === 'approved' 
                      ? 'text-green-400' 
                      : 'text-yellow-400'
                  }`}>
                    {pendingSponsorship.status === 'approved' ? 'Approved' : 'Pending Approval'}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Duration:</span>
                  <span className="font-semibold">
                    {pendingSponsorship.duration ? formatTime(pendingSponsorship.duration) : "Not specified"}
                  </span>
                </div>
                
                {pendingSponsorship.createdAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Requested:</span>
                    <span className="font-semibold">{new Date(pendingSponsorship.createdAt).toLocaleString()}</span>
                  </div>
                )}
                
                {pendingSponsorship.approvedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Approved:</span>
                    <span className="font-semibold">{new Date(pendingSponsorship.approvedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              {pendingSponsorship.status === 'approved' && (
                <div className="mt-8 p-4 bg-black/30 rounded border border-green-500/20 text-sm text-green-300">
                  <p>Your sponsorship request has been approved! You can now proceed with the transaction.</p>
                </div>
              )}
              
              {pendingSponsorship.status !== 'approved' && (
                <div className="mt-8 p-4 bg-black/30 rounded border border-yellow-500/20 text-sm text-yellow-300">
                  <p>Your sponsorship request is being reviewed by the room host.</p>
                </div>
              )}
            </div>
            
            {pendingSponsorship.status === 'approved' ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleTransaction}
                  disabled={isLoading}
                  className={`bg-green-900/40 hover:bg-green-900/60 border border-green-500/30 text-white font-semibold py-3 px-4 rounded-lg transition-colors ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span className="flex gap-2 items-center justify-center">
                    {isLoading ? (
                      <RiLoader5Fill className="animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    Transact
                  </span>
                </button>
                
                <button
                  onClick={handleWithdrawRequest}
                  disabled={isLoading}
                  className={`bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white font-semibold py-3 px-4 rounded-lg transition-colors ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span className="flex gap-2 items-center justify-center">
                    {isLoading ? (
                      <RiLoader5Fill className="animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    Withdraw
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleWithdrawRequest}
                disabled={isLoading}
                className={`w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white font-semibold py-3 px-4 rounded-lg transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="flex gap-2 items-center justify-center">
                  {isLoading ? (
                    <RiLoader5Fill className="animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  Withdraw Request
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="mb-6">
              <label className="block text-lg font-bold text-fireside-orange mb-3">
                Upload Banner
              </label>
              
              <div
                className={`relative w-full min-h-[120px] border-2 border-dashed rounded-lg ${
                  isDragging ? 'border-fireside-orange bg-black/60' : 'border-gray-600 bg-black/40'
                } cursor-pointer`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                
                {selectedImage ? (
                  <div className="relative w-full h-full min-h-[120px] aspect-[3/1] object-cover rounded-lg overflow-hidden">
                    <img 
                      src={selectedImage} 
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
                      Recommended size: 1500x500
                    </p>
                  </div>
                ) : (
                  <div className="w-full aspect-[3/1] flex items-center justify-center">
                      <div className="flex flex-col items-center justify-center p-2">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-300 text-sm text-center">
                      Click to upload or drag and drop
                      <span className="block text-xs text-gray-500">
                        Recommended size: 1500x500
                      </span>
                      <span className="block text-xs text-gray-500">
                        Larger images will be scaled to fit. Max size: 5MB
                      </span>
                    </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-bold text-fireside-orange mb-3">
                Sponsorship Duration: {formatTime(sponsorDuration)}
              </label>
              <input
                type="range"
                min="60"
                max={maxDuration}
                step="60"
                value={sponsorDuration}
                onChange={(e) => setSponsorDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider-fireside"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>1 min</span>
                <span>15 mins</span>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-lg font-bold text-fireside-orange mb-3">
                Estimated Price
              </label>
              <div className="w-full bg-black/40 border border-fireside-orange/30 text-white p-4 rounded-lg text-center">
                <span className="text-2xl font-bold">${calculatePrice(sponsorDuration)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Pricing is based on duration and audience size ({peerCount} {peerCount === 1 ? 'user' : 'users'} in room).
                {peerCount > 5 && ' Premium audience pricing applied.'}
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedImage}
              className={`w-full gradient-fire text-white font-semibold py-3 px-4 rounded-lg transition-colors ${
                isLoading || !selectedImage ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span className="flex gap-2 items-center justify-center">
                {isLoading ? (
                  <RiLoader5Fill className="animate-spin" />
                ) : null}
                Confirm Sponsorship
              </span>
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
    
    {/* Payment Transaction Modal */}
    <Modal
      isOpen={isTransactionModalOpen}
      onClose={() => setIsTransactionModalOpen(false)}
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold text-fireside-orange mb-2">Sponsorship Payment</h3>
          <p className="text-gray-400 text-sm">Complete your sponsorship payment to promote your banner</p>
        </div>
        
        <div className="bg-black/40 rounded-lg p-4 border border-fireside-orange/20">
          <p className="text-sm text-gray-300 mb-2">Estimated Price:</p>
          <p className="text-3xl font-bold text-white text-center">
            ${calculatePrice(pendingSponsorship?.duration || 300)}
          </p>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Based on {formatTime(pendingSponsorship?.duration || 300)} duration with {peerCount} participants
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleETHPayment}
            disabled={processingTx}
            className={`flex flex-col items-center justify-center bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-white p-4 rounded-lg transition-colors ${
              processingTx ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <FaEthereum className="text-3xl mb-2" />
            <span className="font-semibold">Pay with ETH</span>
            {processingTx && <RiLoader5Fill className="animate-spin mt-2" />}
          </button>
          
          <button
            onClick={handleUSDCPayment}
            disabled={processingTx}
            className={`flex flex-col items-center justify-center gradient-fire text-white p-4 rounded-lg transition-colors ${
              processingTx ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <BiSolidDollarCircle className="text-3xl mb-2" />
            <span className="font-semibold">Pay with USDC</span>
            {processingTx && <RiLoader5Fill className="animate-spin mt-2" />}
          </button>
        </div>
        
        <div className="text-xs text-gray-400 mt-4 text-center">
          <p>Payment will be distributed to all participants in this room</p>
          <p className="mt-1">Transaction cannot be reversed once processed</p>
        </div>
      </div>
    </Modal>
  </>
  );
}