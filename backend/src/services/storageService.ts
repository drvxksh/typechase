import { createClient, RedisClientType } from "redis";
import { Game, GameStatus, Player } from "../types";

/**
 * Stores game/player info into redis for some persistence.
 */
export class StorageService {
  private static instance: StorageService;
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = createClient();

    this.redisClient.on("error", (error) =>
      console.error("Redis client error:", error),
    );

    this.redisClient.connect();
  }

  /** Returns a singleton instance of StorageService */
  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  /**
   * Checks if a user with the given ID exists in storage.
   *
   * @param userId - The unique identifier of the user to check.
   * @returns A Promise that resolves to true if the user exists, false otherwise.
   */
  public async checkExistingUser(userId: string): Promise<boolean> {
    const userExists = await this.redisClient.exists(`player:${userId}`);

    return userExists == 1;
  }

  /**
   * Creates a game entry in Redis storage.
   *
   * @param game - The Game object to store.
   * @returns A Promise that resolves when the game is successfully created.
   */
  public async createGame(game: Game): Promise<void> {
    await this.redisClient.json.set(`game:${game.id}`, "$", { ...game });
  }

  /**
   * Updates the current game ID of a player.
   *
   * @param userId - The unique identifier of the player to update.
   * @param gameId - The new game ID to assign to the player.
   * @returns A Promise that resolves when the player's game ID is successfully updated.
   */
  public async updatePlayerGameId(userId: string, gameId: string) {
    const player = (await this.redisClient.json.get(
      `player:${userId}`,
    )) as unknown as Player;
    player.currentGameId = gameId;
    await this.redisClient.json.set(`player:${userId}`, "$", { ...player });
  }

  /**
   * Creates a new player in Redis storage with the specified user ID and game ID.
   *
   * @param userId - The unique identifier for the new player.
   * @param gameId - The ID of the game the player will join.
   * @returns A Promise that resolves when the player is successfully created.
   */
  public async createNewPlayer(userId: string, gameId: string) {
    const newPlayer: Player = {
      id: userId,
      name: userId.substring(0, 5),
      currentGameId: gameId,
      gamesPlayed: [],
    };

    await this.redisClient.json.set(`player:${userId}`, "$", { ...newPlayer });
  }
}
