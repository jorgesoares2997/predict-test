import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { User } from '@/types';
import { toast } from '@/lib/toast';

type UpsertUserPayload = {
  wallet_address: string;
  didit_id?: string | null;
  kyc_status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
};

export const useUsers = () =>
  useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users');
      return data;
    },
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertUserPayload) => {
      const { data } = await apiClient.post('/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create user');
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpsertUserPayload & { id: string }) => {
      const { data } = await apiClient.patch(`/users/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update user');
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete user');
    },
  });
};
