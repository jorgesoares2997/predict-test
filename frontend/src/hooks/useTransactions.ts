import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { TransactionRecord } from '@/types';

export function useTransactions(filters?: { user_id?: string; market_id?: string; result_id?: string }) {
  return useQuery<TransactionRecord[]>({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/transactions', { params: filters });
      return data;
    },
    refetchInterval: 10000, // Refetch every 10s to show new trades
  });
}
