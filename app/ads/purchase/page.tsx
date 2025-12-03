"use client";

import { useEffect, useState } from "react";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { getEthPrice } from "@/utils/commons";
import { encodeFunctionData, numberToHex } from "viem";
import { erc20Abi } from "@/utils/contract/abis/erc20abi";
import { firebaseAdsAbi } from "@/utils/contract/abis/firebaseAdsAbi";
import { contractAdds } from "@/utils/contract/contractAdds";
import {
  createBaseAccountSDK,
  getCryptoKeyAccount,
  base,
} from "@base-org/account";
import { readContract } from "@wagmi/core";
import { config } from "@/utils/providers/rainbow";
import Background from "@/components/UI/Background";
import NavigationWrapper from "@/components/NavigationWrapper";
import AdsPurchaseForm from "@/components/AdsPurchaseForm";
import { isAdsTester } from "@/utils/constants";
import sdk from "@farcaster/miniapp-sdk";
import { toast } from "react-toastify";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { checkStatus } from "@/utils/checkStatus";
import { useSendCalls } from "wagmi";

export default function PurchaseAdPage() {
  const { user } = useGlobalContext();
  const [creating, setCreating] = useState(false);
  const isTester = isAdsTester(user?.fid);

  const { context } = useMiniKit();
  const { sendCalls, isSuccess, status } = useSendCalls();

  const [formData, setFormData] = useState<FormData | null>(null);

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  useEffect(() => {
    // When transaction succeeds
    if (isSuccess) {
      toast.success("Transaction successful!");
      createOnBackend();
    }
    // When transaction fails (status === 'error')
    else if (status === "error") {
      toast.error("Transaction failed. Please try again.");

      console.error("Transaction failed");
    }
  }, [isSuccess, status]);

  const handleERC20Payment = async (price: number, formData: FormData) => {
    try {
      if(!formData) {
        toast.error("Form data is not set");
        return;
      }
      setFormData(formData);
      const distributorAddress = process.env.NEXT_PUBLIC_ADS_DISTRIBUTOR;
      if (!distributorAddress) {
        toast.error("Distributor address not set");
        return;
      }

      const revenueAddress = process.env.NEXT_PUBLIC_ADS_REVENUE;
      if (!revenueAddress) {
        toast.error("Revenue address not set");
        return;
      }

      const usdcAmountToSend = BigInt(Math.floor((price / 2) * 1e6)); // USDC has 6 decimals

      const viewers_call = {
        to: USDC_ADDRESS,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [distributorAddress, usdcAmountToSend],
        }),
      };

      const revenue_call = {
        to: USDC_ADDRESS,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : "0x0",
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [revenueAddress, usdcAmountToSend],
        }),
      };

      const sendingCalls = [viewers_call, revenue_call];

      if (context?.client.clientFid === 309857) {
        toast.loading("Connecting to Base SDK...");

        const provider = createBaseAccountSDK({
          appName: "Fireside",
          appLogoUrl: "https://firesidebase.vercel.app/app-icon2.png",
          appChainIds: [base.constants.CHAIN_IDS.base],
        }).getProvider();

        const cryptoAccount = await getCryptoKeyAccount();
        const fromAddress = cryptoAccount?.account?.address;

        toast.loading("Submitting transaction...");

        const callsId: any = await provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              version: "1.0",
              chainId: numberToHex(base.constants.CHAIN_IDS.base),
              from: fromAddress,
              calls: sendingCalls,
            },
          ],
        });

        toast.loading("Transaction submitted, checking status...");

        const result = await checkStatus(callsId);

        if (result == true) {
          toast.loading("Transaction confirmed!");
          await createOnBackend();
        } else {
          toast.error("Transaction failed or timed out");
        }

        return result;
      } else {
        // @ts-ignore
        sendCalls({ calls: sendingCalls });
      }
    } catch (err) {
      console.error("ERC20 Payment Error:", err);
      toast.error("Failed to process ERC20 payment.");
    }
  };

  const handleEthPayment = async (price:number, formData: FormData) => {
    try {
      if(!formData) {
        toast.error("Form data is not set");
        return;
      }
      setFormData(formData);

      const distributorAddress = process.env.NEXT_PUBLIC_ADS_DISTRIBUTOR;
      if (!distributorAddress) {
        toast.error("Distributor address not set");
        return;
      }

      const revenueAddress = process.env.NEXT_PUBLIC_ADS_REVENUE;
      if (!revenueAddress) {
        toast.error("Revenue address not set");
        return;
      }

      const ethPriceUsd = await getEthPrice();
      if (!ethPriceUsd) {
        toast.error("Failed to fetch ETH price");
        return;
      }

      // Convert USD to ETH
      const tipAmountETH = price / (2*ethPriceUsd);
      
      // Convert ETH to Wei
      const ethValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));

      const viewers_call = {
        to: distributorAddress,
        value: context?.client.clientFid !== 309857 ? ethValueInWei : numberToHex(ethValueInWei),
      };

      const revenue_call = {
        to: revenueAddress,
        value: context?.client.clientFid !== 309857 ? ethValueInWei : numberToHex(ethValueInWei),
      };

      const sendingCalls = [viewers_call, revenue_call];

      if (context?.client.clientFid === 309857) {
        toast.loading("Connecting to Base SDK...");

        const provider = createBaseAccountSDK({
          appName: "Fireside",
          appLogoUrl: "https://firesidebase.vercel.app/app-icon2.png",
          appChainIds: [base.constants.CHAIN_IDS.base],
        }).getProvider();

        const cryptoAccount = await getCryptoKeyAccount();
        const fromAddress = cryptoAccount?.account?.address;

        toast.loading("Submitting transaction...");

        const callsId: any = await provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              version: "1.0",
              chainId: numberToHex(base.constants.CHAIN_IDS.base),
              from: fromAddress,
              calls: sendingCalls,
            },
          ],
        });

        toast.loading("Transaction submitted, checking status...");

        const result = await checkStatus(callsId);

        if (result == true) {
          toast.loading("Transaction confirmed!");
          await createOnBackend();
        } else {
          toast.error("Transaction failed or timed out");
        }

        return result;
      } else {
        // @ts-ignore
        sendCalls({ calls: sendingCalls });
      }

    } catch (err) {
      console.error("ETH Payment Error:", err);
      toast.error("Failed to process ETH payment.");
    }
  };

  const createOnBackend = async () => {
    if(!formData) {
      toast.error("Form data is not set");
      return;
    };
    if (!user?.fid) return;

    // Debug: Log FormData contents
    console.log("FormData contents:");
    const entries = Array.from(formData.entries());
    entries.forEach(([key, value]) => {
      if (value instanceof File) {
        console.log(
          `${key}: File(name: ${value.name}, size: ${value.size}, type: ${value.type})`
        );
      } else {
        console.log(`${key}: ${value}`);
      }
    });

    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    console.log("Making request to:", `${backend}/api/ads/protected/create`);
    console.log("User FID:", user.fid);

    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let authHeader = "Bearer dev";
      if (env !== "DEV") {
        const tokenResponse = await sdk.quickAuth.getToken();
        authHeader = `Bearer ${tokenResponse.token}`;
      }

      const res = await fetch(`${backend}/api/ads/protected/create`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      });

      console.log("Response status:", res.status);
      console.log(
        "Response headers:",
        Object.fromEntries(res.headers.entries())
      );

      const responseText = await res.text();
      console.log("Raw response:", responseText);

      if (!res.ok) {
        let errorMessage = "Failed to create ad";
        try {
          const err = JSON.parse(responseText);
          errorMessage = err?.error || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${res.status}: ${responseText}`;
        }
        throw new Error(errorMessage);
      }

      return JSON.parse(responseText);
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }
  };

  if (!isTester) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="bg-black/50 border border-white/10 rounded-xl p-6 text-center max-w-md">
            <p className="text-white text-lg font-semibold mb-2">
              Ads beta access only
            </p>
            <p className="text-gray-300 text-sm">
              Ads purchasing is currently limited to a small group of testers.
              Please reach out to the team if you need access.
            </p>
          </div>
        </div>
        <NavigationWrapper />
      </>
    );
  }

  return (
    <>
      <AdsPurchaseForm handleETHPayment={handleEthPayment} handleERC20Payment={handleERC20Payment} loading={creating} />
      <NavigationWrapper />
    </>
  );
}
