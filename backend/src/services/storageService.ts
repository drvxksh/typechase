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
   * Checks if a player with the given ID exists in storage.
   *
   * @param userId - The unique identifier of the user to check.
   * @returns A Promise that resolves to true if the user exists, false otherwise.
   */
  public async checkExistingPlayer(playerId: string): Promise<boolean> {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    return playerExists == 1;
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
   * Updates the current game ID of a player and adds the player to the game
   *
   * @param playerId - The unique identifier of the player to update.
   * @param gameId - The new game ID to assign to the player.
   * @returns A Promise that resolves when the player's game ID is successfully updated.
   */
  public async updatePlayerGameId(playerId: string, gameId: string) {
    // change the currentGameId of the player
    const player = (await this.redisClient.json.get(
      `player:${playerId}`,
    )) as unknown as Player;

    player.currentGameId = gameId;

    await this.redisClient.json.set(`player:${playerId}`, "$", { ...player });

    // add this playerId in the game
    const game = (await this.redisClient.json.get(
      `game:${gameId}`,
    )) as unknown as Game;

    game.playerIds.push(player.id);

    await this.redisClient.json.set(`game:${gameId}`, "$", { ...game });
  }

  /**
   * Creates a new player in Redis storage with the specified user ID and game ID. also adds the player to the game
   *
   * @param userId - The unique identifier for the new player.
   * @param gameId - The ID of the game the player will join.
   * @returns A Promise that resolves when the player is successfully created.
   */
  public async createNewPlayer(playerId: string, gameId: string) {
    // create the player
    const newPlayer: Player = {
      id: playerId,
      name: playerId.substring(0, 5),
      currentGameId: gameId,
      gamesPlayed: [],
    };

    await this.redisClient.json.set(`player:${playerId}`, "$", {
      ...newPlayer,
    });

    // add the player to the game
    const game = (await this.redisClient.json.get(
      `game:${gameId}`,
    )) as unknown as Game;

    game.playerIds.push(newPlayer.id);

    await this.redisClient.json.set(`game:${gameId}`, "$", { ...game });
  }

  /**
   * Gets the number of players in a game room.
   *
   * @param gameId - The unique identifier of the game room to check.
   * @returns A Promise that resolves to the number of players in the room.
   * @throws Error if the room with the specified ID does not exist.
   */
  public async getRoomSize(gameId: string): Promise<number> {
    // verify that the room actually is there or not
    const roomExists = await this.redisClient.exists(`game:${gameId}`);

    if (roomExists !== 1) {
      throw new Error("Room with ID ${gameId} does not exist");
    }

    // fetch the size of the room
    const game = (await this.redisClient.json.get(
      `game:${gameId}`,
    )) as unknown as Game;

    return game.playerIds.length;
  }
}
