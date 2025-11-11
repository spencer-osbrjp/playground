import { STATUS_TIMEOUT } from '../config/constants';

export type StatusType = 'info' | 'error' | 'success';

/**
 * Show a status message to the user
 */
export const showStatus = (message: string, type: StatusType = 'info'): void => {
  const statusEl = document.querySelector('#status') as HTMLElement;
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'show ' + type;
  }
};

/**
 * Hide the status message
 */
export const hideStatus = (): void => {
  const statusEl = document.querySelector('#status') as HTMLElement;
  if (statusEl) {
    statusEl.className = '';
  }
};

/**
 * Show a status message that auto-hides after a timeout
 */
export const showStatusWithTimeout = (
  message: string,
  type: StatusType = 'info',
  timeout: number = STATUS_TIMEOUT
): void => {
  showStatus(message, type);
  setTimeout(hideStatus, timeout);
};
