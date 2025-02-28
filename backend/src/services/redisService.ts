import { createClient, RedisClientType } from "redis";

export class RedisService {
  private static instance: RedisService;
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = createClient();

    this.redisClient.on("error", (err) =>
      console.error("Redis Client failed with", err)
    );

    this.redisClient.connect();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }

    return RedisService.instance;
  }

  public async hSet(key: string, value: any): Promise<void> {
    await this.redisClient.hSet(key, value);
  }

  public async hGet(key: string): Promise<any> {
    const data = await this.redisClient.hGetAll(key);
    return data;
  }
}
