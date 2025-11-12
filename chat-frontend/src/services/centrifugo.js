import { Centrifuge } from "centrifuge";

class CentrifugoService {
  constructor() {
    this.centrifuge = null;
    this.subscriptions = new Map();
    this.isConnected = false;
    this.connectionPromise = null; // Track connection state
    this.connectionResolve = null;
  }

  async initialize(token) {
    if (this.centrifuge) {
      this.disconnect();
    }

    // Create a promise to track connection state
    this.connectionPromise = new Promise((resolve) => {
      this.connectionResolve = resolve;
    });

    this.centrifuge = new Centrifuge(
      import.meta.env.CENTRIFUGO_WS_URL ||
        "ws://10.10.7.30:9001/connection/websocket",
      {
        token: token,
      }
    );

    this.centrifuge.on("connecting", (ctx) => {
      console.log("Connecting to Centrifugo...", ctx);
    });

    this.centrifuge.on("connected", (ctx) => {
      console.log("Connected to Centrifugo", ctx);
      this.isConnected = true;
      this.connectionResolve(true); // Resolve when connected
    });

    this.centrifuge.on("disconnected", (ctx) => {
      console.log("Disconnected from Centrifugo", ctx);
      this.isConnected = false;
    });

    this.centrifuge.on("error", (ctx) => {
      console.error("Centrifugo error:", ctx);
      this.connectionResolve(false); // Resolve even on error
    });

    this.centrifuge.connect();

    return this.connectionPromise;
  }

  async subscribe(channel, callbacks) {
    if (!this.centrifuge) {
      console.error("Centrifugo not initialized");
      return;
    }

    // Wait for connection to be established
    if (!this.isConnected && this.connectionPromise) {
      const connected = await this.connectionPromise;
      if (!connected) {
        console.error("Cannot subscribe: Centrifugo connection failed");
        return;
      }
    }

    // Check if already subscribed
    if (this.subscriptions.has(channel)) {
      console.log(`Already subscribed to ${channel}`);
      return this.subscriptions.get(channel);
    }

    const sub = this.centrifuge.newSubscription(channel);

    sub.on("publication", (ctx) => {
      console.log(`Received message on ${channel}:`, ctx.data);
      if (callbacks.onMessage) {
        callbacks.onMessage(ctx.data);
      }
    });

    sub.on("subscribing", (ctx) => {
      console.log(`Subscribing to ${channel}`, ctx);
    });

    sub.on("subscribed", (ctx) => {
      console.log(`Subscribed to ${channel}`, ctx);
    });

    sub.on("error", (ctx) => {
      console.error(`Subscription error for ${channel}:`, ctx);
    });

    sub.subscribe();
    this.subscriptions.set(channel, sub);

    return sub;
  }

  unsubscribe(channel) {
    const sub = this.subscriptions.get(channel);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(channel);
      console.log(`Unsubscribed from ${channel}`);
    }
  }

  disconnect() {
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.subscriptions.clear();
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }
}

export const centrifugoService = new CentrifugoService();
