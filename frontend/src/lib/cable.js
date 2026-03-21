import { createConsumer } from "@rails/actioncable";

const CABLE_URL = import.meta.env.VITE_CABLE_URL || "ws://localhost:3000/cable";

export const consumer = createConsumer(CABLE_URL);

// Helper: subscribe to a channel and return an unsubscribe function
export function subscribe(channelName, callbacks = {}) {
  const subscription = consumer.subscriptions.create(channelName, {
    connected()    { callbacks.connected?.(); },
    disconnected() { callbacks.disconnected?.(); },
    received(data) { callbacks.received?.(data); },
  });
  return () => subscription.unsubscribe();
}
