"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { getEthPrice } from '@/utils/commons';
import { encodeFunctionData, numberToHex } from 'viem';
import { erc20Abi } from '@/utils/contract/abis/erc20abi';
import { firebaseAdsAbi } from '@/utils/contract/abis/firebaseAdsAbi';
import { contractAdds } from '@/utils/contract/contractAdds';
import { createBaseAccountSDK, getCryptoKeyAccount, base } from '@base-org/account';
import { readContract } from '@wagmi/core';
import { config } from '@/utils/providers/rainbow';
import Background from '@/components/UI/Background';
import NavigationWrapper from '@/components/NavigationWrapper';
import AdsPurchaseForm from '@/components/AdsPurchaseForm';

export default function PurchaseAdPage() {
  const { user } = useGlobalContext();
  const [creating, setCreating] = useState(false);

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  const createOnBackend = async (formData: FormData) => {
    if (!user?.fid) return;
    
    // Debug: Log FormData contents
    console.log('FormData contents:');
    const entries = Array.from(formData.entries());
    entries.forEach(([key, value]) => {
      if (value instanceof File) {
        console.log(`${key}: File(name: ${value.name}, size: ${value.size}, type: ${value.type})`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });
    
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    console.log('Making request to:', `${backend}/api/ads/protected/create`);
    console.log('User FID:', user.fid);
    
    try {
      const res = await fetch(`${backend}/api/ads/protected/create`, {
        method: 'POST',
        headers: {
          'x-user-fid': String(user.fid),
        },
        body: formData,
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      const responseText = await res.text();
      console.log('Raw response:', responseText);

      if (!res.ok) {
        let errorMessage = 'Failed to create ad';
        try {
          const err = JSON.parse(responseText);
          errorMessage = err?.error || errorMessage;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${res.status}: ${responseText}`;
        }
        throw new Error(errorMessage);
      }
      
      return JSON.parse(responseText);
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    setCreating(true);
    try {
      const paymentMethod = formData.get('paymentMethod') as string;
      console.log('Starting form submission with payment method:', paymentMethod);

      // Create mock transaction hash
      const txHash = `mock-${paymentMethod.toLowerCase()}-${Date.now()}`;
      console.log('Generated txHash:', txHash);
      
      // Add txHash to formData
      formData.append('txHash', txHash);

      // Create ad on backend
      console.log('Calling createOnBackend...');
      const result = await createOnBackend(formData);
      console.log('Backend response:', result);

      alert(`Ad created successfully (mock ${paymentMethod} transaction).`);
    } catch (e: any) {
      console.error('Form submission error:', e);
      alert(e?.message || 'Failed to create ad');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <AdsPurchaseForm onSubmit={handleFormSubmit} loading={creating} />
      <NavigationWrapper />
    </>
  );
}


