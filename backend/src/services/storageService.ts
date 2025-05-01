import { createClient, RedisClientType } from "redis";
import { Game, GameResult, Player, TTL } from "../types";

/** Stores game,player and gameResult objects */
export class StorageService {
  private static instance: StorageService;
  private redisClient: RedisClientType;

  private constructor() {
    // instantiate the redis client.
    // this.redisClient = createClient({
    //   socket: {
    //     host: "redis",
    //     port: 6379,
    //   },
    // });
    this.redisClient = createClient();

    this.redisClient.on("error", (error) =>
      console.error("Redis client error:", error)
    );

    this.redisClient.connect();
  }

  /** Returns a singleton instance of StorageService */
  public static getInstance() {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  /**
   * Returns the game object for a given gameId.
   * Refreshes its TTL to refresh the expiration.
   * @throws if the specified game room with that id does not exist
   */
  public async getGameObj(gameId: string) {
    // check whether the game exists. 1 denotes that it does
    const roomExists = await this.redisClient.exists(`game:${gameId}`);

    if (roomExists !== 1) {
      throw new Error(`Room with ID ${gameId} does not exist`);
    }

    const game = (await this.redisClient.json.get(
      `game:${gameId}`
    )) as unknown as Game;

    // refresh the TTL
    await this.redisClient.expire(`game:${gameId}`, TTL);

    return game;
  }

  /** Saves a given game object and refreshes its TTL */
  public async saveGameObj(gameObj: Game) {
    await this.redisClient.json.set(`game:${gameObj.id}`, "$", { ...gameObj });

    // update the expiry time.
    await this.redisClient.expire(`game:${gameObj.id}`, TTL);
  }

  /** Deletes a game obj */
  public async deleteGameObj(gameId: string) {
    await this.redisClient.json.del(`game:${gameId}`);
  }

  /**
   * Returns a player object for a given playerId and refreshes its TTL.
   * @throws Error if the specified player with that id does not exist
   */
  public async getPlayerObj(playerId: string) {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    if (playerExists !== 1) {
      throw new Error(`Player with ID ${playerId} oes not exist`);
    }

    const player = (await this.redisClient.json.get(
      `player:${playerId}`
    )) as unknown as Player;

    // refresh the expiry of the player obj
    await this.redisClient.expire(`player:${playerId}`, TTL);

    return player;
  }

  /** Saves a Player object and refreshes its TTL */
  public async savePlayerObj(playerObj: Player) {
    await this.redisClient.json.set(`player:${playerObj.id}`, "$", {
      ...playerObj,
    });

    await this.redisClient.expire(`player:${playerObj.id}`, TTL);
  }

  /**
   * Returns the gameResult object and refreshes its TTL.
   * @throws if the gameId is invalid
   */
  public async getGameResultObj(gameId: string) {
    const gameResultExists = await this.redisClient.exists(
      `gameResult:${gameId}`
    );

    if (gameResultExists !== 1) {
      throw new Error(`Game Result with ID ${gameId} does not exist`);
    }

    const gameResultObj = (await this.redisClient.json.get(
      `gameResult:${gameId}`
    )) as unknown as GameResult;

    // refresh the expiry of the player obj
    await this.redisClient.expire(`gameResult:${gameId}`, TTL);

    return gameResultObj;
  }

  /** Saves a GameResult object and refreshes its TTL */
  public async saveGameResultObj(gameResultObj: GameResult) {
    await this.redisClient.json.set(`gameResult:${gameResultObj.id}`, "$", {
      ...gameResultObj,
    });

    await this.redisClient.expire(`gameResult:${gameResultObj.id}`, TTL);
  }

  /** Verifies whether a player object with the given playerId exists or not */
  public async validatePlayerId(playerId: string) {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    return playerExists === 1;
  }

  /** Verifies whether a game object with the given gameId exists or not */
  public async validateGameId(gameId: string) {
    const gameExists = await this.redisClient.exists(`game:${gameId}`);

    return gameExists === 1;
  }

  /** Verifies whether a gameResult object with the given gameId exists or not */
  public async validateGameResultId(gameId: string) {
    const gameResultExists = await this.redisClient.exists(
      `gameResult:${gameId}`
    );

    return gameResultExists === 1;
  }
}
