import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

type ToastType = 'success' | 'error' | 'info';

const toastPalette: Record<ToastType, string> = {
  success: 'linear-gradient(135deg, #16a34a, #22c55e)',
  error: 'linear-gradient(135deg, #b91c1c, #ef4444)',
  info: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
};

function showToast(message: string, type: ToastType) {
  Toastify({
    text: message,
    duration: 3500,
    gravity: 'top',
    position: 'right',
    close: true,
    stopOnFocus: true,
    style: {
      background: toastPalette[type],
      borderRadius: '10px',
      fontSize: '14px',
    },
  }).showToast();
}

export const toast = {
  success(message: string) {
    showToast(message, 'success');
  },
  error(message: string) {
    showToast(message, 'error');
  },
  info(message: string) {
    showToast(message, 'info');
  },
};
