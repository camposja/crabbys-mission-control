import { useEffect, useRef } from "react";
import { subscribe } from "../lib/cable";

// Subscribe to an Action Cable channel; callback fires on every received message.
// Automatically unsubscribes on component unmount.
export function useChannel(channelName, onReceived, deps = []) {
  const callbackRef = useRef(onReceived);

  useEffect(() => {
    callbackRef.current = onReceived;
  });

  useEffect(() => {
    if (!channelName) return;
    const unsubscribe = subscribe(channelName, {
      received: (data) => callbackRef.current(data),
    });
    return unsubscribe;
  }, [channelName, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}
