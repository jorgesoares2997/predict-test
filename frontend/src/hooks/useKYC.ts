import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/lib/toast';
// Assuming the SDK import based on search results
import { DiditSdk } from '@didit-protocol/sdk-web';

export const useKYC = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const { user, setKYCStatus } = useAuthStore();

  const startVerification = async () => {
    if (!user) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsVerifying(true);
    try {
      const verificationUrl = process.env.NEXT_PUBLIC_DIDIT_VERIFICATION_URL;
      if (!verificationUrl) {
        throw new Error('Missing NEXT_PUBLIC_DIDIT_VERIFICATION_URL');
      }

      // SDK v0.2.0 is a singleton API: use DiditSdk.shared.
      const didit = DiditSdk.shared;
      didit.onComplete = (result) => {
        if (result.type === 'completed') {
          setKYCStatus('pending');
          toast.success('KYC verification submitted!');
          return;
        }
        if (result.type === 'failed') {
          toast.error('KYC verification failed');
        }
      };

      await didit.startVerification({
        url: verificationUrl,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to initialize KYC');
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    startVerification,
    isVerifying,
    status: user?.kycStatus || 'none',
  };
};
