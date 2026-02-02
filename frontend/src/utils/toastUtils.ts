import { toast } from 'react-toastify';

type ToastType = 'success' | 'error' | 'info' | 'warn';

export const showToast = (message: string, type: ToastType = 'info') => {
  switch (type) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warn':
      toast.warn(message);
      break;
    case 'info':
    default:
      toast.info(message);
      break;
  }
};

