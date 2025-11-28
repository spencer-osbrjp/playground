// Extend the Window interface in TypeScript to acknowledge

import type { Direction } from "./layouting";

// the existence of the React Native WebView bridge object
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

const sendMessageToRN = (direction: Direction) => {
  if (!window.ReactNativeWebView) return;

  window.ReactNativeWebView.postMessage(JSON.stringify({ direction }));
};

export { sendMessageToRN };
