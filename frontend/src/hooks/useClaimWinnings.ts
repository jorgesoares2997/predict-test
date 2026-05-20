import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { stellarService } from '@/services/stellarService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/lib/toast';

interface ClaimParams {
  marketId: string;
}

export const useClaimWinnings = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const executeClaim = async ({ marketId }: ClaimParams) => {
    if (!user) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { xdr, transactionId } } = await apiClient.post('/trades/claim/prepare', {
        marketId,
      });

      const signedXDR = await stellarService.signTransaction(xdr, user.publicKey);

      if (!signedXDR) throw new Error('Failed to sign transaction');

      const { data: result } = await apiClient.post('/trades/claim/execute', {
        signedXDR,
        transactionId,
      });

      queryClient.invalidateQueries({ queryKey: ['user-market-transactions', user.id, marketId] });
      queryClient.invalidateQueries({ queryKey: ['market', marketId] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      toast.success('Winnings claimed successfully!');
      return result;
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error.response?.data?.message || 'Failed to claim winnings');
    } finally {
      setIsProcessing(false);
    }
  };

  return { executeClaim, isProcessing };
};
