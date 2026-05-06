import { useState } from 'react';
import apiClient from '@/services/apiClient';
import { stellarService } from '@/services/stellarService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/lib/toast';
import Decimal from 'decimal.js';

interface TradeParams {
  marketId: string;
  outcomeId: string;
  amount: string; // USDC amount
}

export const useExecuteTrade = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuthStore();

  const executeTrade = async ({ marketId, outcomeId, amount }: TradeParams) => {
    if (!user) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Get transaction XDR from backend (prepared for Soroban)
      // The backend should prepare the Soroban call (deposit USDC -> Contract)
      const { data: { xdr } } = await apiClient.post('/trades/prepare', {
        marketId,
        outcomeId,
        amount: new Decimal(amount).toString(),
      });

      // 2. Sign with the kit
      const signedXDR = await stellarService.signTransaction(xdr, user.publicKey);

      if (!signedXDR) throw new Error('Failed to sign transaction');

      // 3. Submit to Stellar (can be done via Horizon or backend)
      // Here we let the backend submit and verify to keep the ledger and DB in sync
      const { data: result } = await apiClient.post('/trades/execute', {
        signedXDR,
        marketId,
        outcomeId,
        amount,
      });

      toast.success('Trade executed successfully!');
      return result;
    } catch (error: any) {
      console.error('Trade error:', error);
      toast.error(error.response?.data?.message || 'Failed to execute trade');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    executeTrade,
    isProcessing,
  };
};
