import { createConsumer } from "@rails/actioncable";
import { CABLE_URL } from "./config";

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
