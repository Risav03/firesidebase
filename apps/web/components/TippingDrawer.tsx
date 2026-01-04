'use client'

import { useState, useEffect, useRef } from 'react';
import { useHMSActions, useHMSStore, selectLocalPeer } from '@100mslive/react-sdk';
import { useGlobalContext } from '@/utils/providers/globalContext';
import sdk from '@farcaster/miniapp-sdk';
import { toast } from 'react-toastify';
import { useTipEvent } from '@/utils/events';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/UI/drawer';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { encodeFunctionData } from 'viem';
import { contractAdds } from '@/utils/contract/contractAdds';
import { firebaseTipsAbi } from '@/utils/contract/abis/firebaseTipsAbi';
import { erc20Abi as erc20AbiImport } from '@/utils/contract/abis/erc20abi';
import { executeTransaction, TransactionCall } from '@/utils/transactionHelpers';
import { useAccount, useSendCalls } from 'wagmi';
import { numberToHex } from 'viem';
import Image from 'next/image';
import Input from './UI/Input';

interface TippingDrawerProps {
  peer: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function TippingDrawer({ peer, isOpen, onClose }: TippingDrawerProps) {
  const hmsActions = useHMSActions();
  const localPeer = useHMSStore(selectLocalPeer);
  
  const [tipAmount, setTipAmount] = useState<string>('');
  const [isTipping, setIsTipping] = useState(false);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [firePrice, setFirePrice] = useState<number | null>(null);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const FIRE_ADDRESS = '0x9e68E029cBDe7513620Fcb537A44abff88a56186';
  
  const { user } = useGlobalContext();
  const { context } = useMiniKit();
  const { address } = useAccount();
  const { sendCalls, isSuccess, status } = useSendCalls();
  const lastCurrencyRef = useRef<string>('ETH');
  
  const { sendTipNotification } = useTipEvent();

  const fetchTokenPrices = async () => {
    try {
      setIsFetchingPrices(true);
      
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          setEthPrice(data.ethereum.usd);
        }
      } catch (ethError) {
        console.error('Error fetching ETH price:', ethError);
      }

      try {
        const fireResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${FIRE_ADDRESS}`
        );
        
        if (fireResponse.ok) {
          const fireData = await fireResponse.json();
          if (fireData.pairs && fireData.pairs.length > 0) {
            setFirePrice(parseFloat(fireData.pairs[0].priceUsd));
          }
        }
      } catch (fireError) {
        console.error('Error fetching FIRE price:', fireError);
      }
    } catch (error) {
      console.error('Error fetching token prices:', error);
    } finally {
      setIsFetchingPrices(false);
    }
  };
  
  useEffect(() => {
    const handleTransactionStatus = async () => {
      if (isSuccess) {
        await processSuccess(lastCurrencyRef.current);
      } else if (status === 'error') {
        toast.error('Transaction failed. Please try again.');
        setIsTipping(false);
      }
    };
    handleTransactionStatus();
  }, [isSuccess, status]);
  
  useEffect(() => {
    if (isOpen) {
      fetchTokenPrices();
    }
  }, [isOpen]);

  const processSuccess = async (currency: string) => {
    const tipAmountUSD = parseFloat(tipAmount);
    const tipper = user?.username || 'Someone';
    const recipient = peer.name || 'User';
    
    sendTipNotification(tipper, peer.id, tipAmountUSD, currency);
    
    const emoji = tipAmountUSD >= 100 ? '💸' : tipAmountUSD >= 25 ? '🎉' : '👍';
    const message = `${emoji} ${tipper} tipped ${recipient} $${tipAmountUSD} in ${currency}!`;
    hmsActions.sendBroadcastMessage(message);
    
    toast.success('Tip sent successfully!');
    setTipAmount('');
    setIsTipping(false);
    onClose();
  };
  
  const handleETHTip = async () => {
    const env = process.env.NEXT_PUBLIC_ENV;
    let token: any = '';
    if (env !== 'DEV') {
      token = (await sdk.quickAuth.getToken()).token;
    }
    
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      if (!ethPrice) {
        toast.error('ETH price not available. Please try again.');
        setIsTipping(false);
        return;
      }
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const recipientWallet = metadata?.wallet || peer.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = 'ETH';
      
      const tipAmountUSD = parseFloat(tipAmount);
      const tipAmountETH = tipAmountUSD / ethPrice;
      const ethValueInWei = BigInt(Math.floor(tipAmountETH * 1e18));
      
      const sendingCalls: TransactionCall[] = [{
        to: contractAdds.tipping as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? ethValueInWei : numberToHex(ethValueInWei),
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeETH',
          args: [[recipientWallet]],
        }),
      }];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: context?.client.clientFid,
        sendCalls,
        onSuccess: async () => {
          await processSuccess('ETH');
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error('Error tipping with ETH:', error);
      toast.error(`Failed to process tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTipping(false);
    }
  };
  
  const handleTokenTip = async (tokenAddress: string, tokenSymbol: string) => {
    try {
      setIsTipping(true);
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        toast.error('Please enter a valid tip amount');
        setIsTipping(false);
        return;
      }
      
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const recipientWallet = metadata?.wallet || peer.wallet;
      
      if (!recipientWallet) {
        toast.error('Recipient wallet not found');
        setIsTipping(false);
        return;
      }
      
      lastCurrencyRef.current = tokenSymbol;
      
      const tipAmountUSD = parseFloat(tipAmount);
      let tokenAmount: bigint;
      
      if (tokenSymbol === 'USDC') {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      } else if (tokenSymbol === 'FIRE') {
        if (!firePrice) {
          toast.error('FIRE price not available. Please try again.');
          setIsTipping(false);
          return;
        }
        const tipAmountFIRE = tipAmountUSD / firePrice;
        tokenAmount = BigInt(Math.floor(tipAmountFIRE * 1e18));
      } else {
        tokenAmount = BigInt(Math.floor(tipAmountUSD * 1e6));
      }
      
      const approveCall = {
        to: tokenAddress as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : '0x0',
        data: encodeFunctionData({
          abi: erc20AbiImport,
          functionName: 'approve',
          args: [contractAdds.tipping, tokenAmount],
        }),
      };
      
      const distributeCall = {
        to: contractAdds.tipping as `0x${string}`,
        value: context?.client.clientFid !== 309857 ? BigInt(0) : '0x0',
        data: encodeFunctionData({
          abi: firebaseTipsAbi,
          functionName: 'distributeToken',
          args: [tokenAddress, [recipientWallet], tokenAmount],
        }),
      };
      
      const sendingCalls: TransactionCall[] = [approveCall, distributeCall];
      
      const result = await executeTransaction({
        calls: sendingCalls,
        clientFid: context?.client.clientFid,
        sendCalls,
        onSuccess: async () => {
          await processSuccess(tokenSymbol);
        },
      });
      
      if (!result.success) {
        setIsTipping(false);
      }
    } catch (error) {
      console.error(`Error tipping with ${tokenSymbol}:`, error);
      toast.error('Failed to process tip. Please try again.');
      setIsTipping(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className=" gradient-green-bg " >
        <DrawerHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700">
              {peer.metadata ? <><Image unoptimized src={JSON.parse(peer.metadata).avatar} alt={`${peer.name}'s avatar`} width={48} height={48} className="rounded-full w-full h-full" /></> : <><span className="text-white text-lg font-medium">
                {peer.name?.charAt(0).toUpperCase()}
              </span></>}
            </div>
            <div>
              <DrawerTitle className="text-white">Tip {peer.name}</DrawerTitle>
            </div>
          </div>
        </DrawerHeader>
        
        <div className="px-4 pb-8">
          <div className="mb-6">
            <label className="block text-white text-sm mb-2">Amount (USD)</label>
            <Input
              type="number"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neutral-green focus:ring-neutral-green"
              disabled={isTipping}
            />
          </div>

          {isFetchingPrices ? (
            <div className="text-center text-gray-400 mb-4">
              Loading prices...
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {ethPrice && (
                <button
                  onClick={handleETHTip}
                  disabled={isTipping || !tipAmount}
                  className="w-full px-4 py-3 gradient-indigo-bg bg-fireside-indigo/10 border-[1px] border-fireside-indigo/10 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
                >
                  {isTipping ? 'Processing...' : `Tip with ETH (~${tipAmount ? (parseFloat(tipAmount) / ethPrice).toFixed(6) : '0'} ETH)`}
                </button>
              )}
              
              <button
                onClick={() => handleTokenTip(USDC_ADDRESS, 'USDC')}
                disabled={isTipping || !tipAmount}
                className="w-full px-4 py-3 gradient-blue-bg bg-fireside-blue/30 border-[1px] border-fireside-blue/30 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
              >
                {isTipping ? 'Processing...' : 'Tip with USDC'}
              </button>
              
              {firePrice && (
                <button
                  onClick={() => handleTokenTip(FIRE_ADDRESS, 'FIRE')}
                  disabled={isTipping || !tipAmount}
                  className="w-full px-4 py-3 gradient-orange-bg border-[1px] border-fireside-orange/10 bg-fireside-orange/10 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
                >
                  {isTipping ? 'Processing...' : `Tip with FIRE (~${tipAmount ? (parseFloat(tipAmount) / firePrice).toFixed(2) : '0'} FIRE)`}
                </button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
