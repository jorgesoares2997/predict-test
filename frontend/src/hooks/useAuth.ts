import { stellarService } from '@/services/stellarService';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthResponse } from '@/types';
import { toast } from '@/lib/toast';

const AUTH_STEP_TIMEOUT_MS = 30000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const useAuth = () => {
  const { setAuth, setPublicKey, logout, isAuthLoading, setAuthLoading } = useAuthStore();

  const connect = async () => {
    if (useAuthStore.getState().isAuthLoading) {
      return;
    }

    setAuthLoading(true);
    try {
      const publicKey = await withTimeout(
        stellarService.connectWallet(),
        AUTH_STEP_TIMEOUT_MS,
        'Wallet connection'
      );
      setPublicKey(publicKey);
      console.log('[auth] wallet connected', { publicKey });
      
      // 1. Get challenge from backend
      const { data: challenge } = await withTimeout(
        apiClient.post('/auth/challenge', { publicKey }),
        AUTH_STEP_TIMEOUT_MS,
        'Auth challenge request'
      );
      console.log('[auth] challenge received', { messageLength: challenge.message?.length });
      
      // 2. Sign challenge with Freighter
      const signature = await withTimeout(
        stellarService.signAuthMessage(challenge.message, publicKey),
        AUTH_STEP_TIMEOUT_MS,
        'Challenge signing'
      );
      console.log('[auth] signature ready', {
        format: signature.startsWith('xdr:') ? 'xdr' : 'message',
        length: signature.length,
      });
      
      // 3. Verify on backend and get JWT
      const { data: authData }: { data: AuthResponse } = await withTimeout(
        apiClient.post('/auth/verify', {
          publicKey,
          signature,
        }),
        AUTH_STEP_TIMEOUT_MS,
        'Auth verification'
      );
      
      setAuth(authData.user, authData.token);
      toast.success('Successfully connected!');
    } catch (error: any) {
      console.error(error);
      console.error('[auth] verify/login failed', {
        status: error?.response?.status,
        data: error?.response?.data,
      });
      toast.error(error.message || 'Failed to connect wallet');
      logout();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (useAuthStore.getState().isAuthLoading) {
      return;
    }

    setAuthLoading(true);
    try {
      await stellarService.disconnectWallet();
    } finally {
      logout();
      toast.success('Disconnected successfully');
      setAuthLoading(false);
    }
  };

  return {
    connect,
    isLoading: isAuthLoading,
    logout: handleLogout,
  };
};
