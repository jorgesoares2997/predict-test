import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { Market } from '@/types';
import { toast } from '@/lib/toast';

function apiErrorMessage(error: any, fallback: string): string {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    (Array.isArray(error?.response?.data?.details)
      ? error.response.data.details.map((d: any) => d?.message).filter(Boolean).join(' ')
      : '') ||
    error?.message ||
    fallback
  );
}

export const useMarkets = (filters?: { category?: string; status?: string }) => {
  return useQuery<Market[]>({
    queryKey: ['markets', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/markets', { params: filters });
      return data;
    },
  });
};

export const useMarket = (id: string) => {
  return useQuery<Market>({
    queryKey: ['market', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/markets/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

type OutcomeField = { id?: string; name: string };

type MarketFormPayload = {
  id?: string;
  title: string;
  description: string;
  categoryId: string;
  status: 'active' | 'locked' | 'resolved';
  contractAddress?: string;
  closingDate: Date | string;
  liquidateAt: Date | string;
  outcomes: OutcomeField[];
  resolutionSource: string;
};

function toIsoDateTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
}

export const useCreateMarket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newMarket: MarketFormPayload) => {
      const closing_date = toIsoDateTime(newMarket.closingDate);
      const liquidate_at = toIsoDateTime(newMarket.liquidateAt);
      const results = newMarket.outcomes.map((o) => (o.name || '').trim()).filter(Boolean);
      if (results.length < 2) {
        throw new Error('At least two outcomes are required');
      }
      const payload = {
        title: newMarket.title,
        description: newMarket.description,
        ...(newMarket.categoryId?.trim() ? { category_id: newMarket.categoryId.trim() } : {}),
        status: newMarket.status.toUpperCase(),
        contract_address: newMarket.contractAddress?.trim() ? newMarket.contractAddress.trim() : null,
        resolution_source: newMarket.resolutionSource.trim(),
        closing_date,
        liquidate_at,
        results,
      };
      const { data } = await apiClient.post('/markets', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      toast.success('Market created successfully');
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Failed to create market'));
    },
  });
};

export const useUpdateMarket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: MarketFormPayload & { id: string }) => {
      const closing_date = toIsoDateTime(updates.closingDate);
      const liquidate_at = toIsoDateTime(updates.liquidateAt);
      const results = updates.outcomes
        .map((o) => ({
          ...(o.id ? { id: o.id } : {}),
          name: (o.name || '').trim(),
        }))
        .filter((o) => o.name.length > 0);
      if (results.length < 2) {
        throw new Error('At least two outcomes are required');
      }
      const payload = {
        title: updates.title,
        description: updates.description,
        status: updates.status.toUpperCase(),
        contract_address: updates.contractAddress?.trim() ? updates.contractAddress.trim() : null,
        resolution_source: updates.resolutionSource.trim(),
        category_id: updates.categoryId?.trim() ? updates.categoryId.trim() : null,
        closing_date,
        liquidate_at,
        results,
      };
      const { data } = await apiClient.patch(`/markets/${id}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['market', variables.id] });
      toast.success('Market updated successfully');
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Failed to update market'));
    },
  });
};

export const useDeleteMarket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/markets/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['market', id] });
      toast.success('Market deleted successfully');
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Failed to delete market'));
    },
  });
};
