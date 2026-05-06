import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { Category } from '@/types';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

export const useCategories = () => {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/categories');
      return data;
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newCategory: { name: string }) => {
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error('You must be authenticated to create categories');
      }
      const { data } = await apiClient.post('/categories', newCategory);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
      if (err.response?.status === 401) {
        toast.error('Session expired or not authenticated. Connect wallet/login again.');
        return;
      }
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to create category');
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await apiClient.patch(`/categories/${id}`, { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category updated successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
      if (err.response?.status === 401) {
        toast.error('Session expired or not authenticated. Connect wallet/login again.');
        return;
      }
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to update category');
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
      if (err.response?.status === 401) {
        toast.error('Session expired or not authenticated. Connect wallet/login again.');
        return;
      }
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to delete category');
    },
  });
};
