import { createClient, RedisClientType } from "redis";
import { WebSocketMessage } from "../types";

export class PubSubManager {
  private static instance: PubSubManager;
  private subscriber: RedisClientType;

  private constructor() {
    this.subscriber = createClient();

    this.subscriber.on("error", (err) =>
      console.error("Redis Subscriber failed with", err)
    );

    this.subscriber.connect();
  }

  public static getInstance(): PubSubManager {
    if (!PubSubManager.instance) {
      PubSubManager.instance = new PubSubManager();
    }

    return PubSubManager.instance;
  }

  public async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }
}
