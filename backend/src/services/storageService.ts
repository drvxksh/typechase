import { createClient, RedisClientType } from "redis";
import { GameStatus, Player } from "../types";

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

  public async addGame(
    gameId: string,
    gameText: string,
    host: Player,
  ): Promise<void> {
    const gameData = {
      id: gameId,
      hostUserId: host.id,
      players: JSON.stringify([host]),
      gameText,
      createdAt: Date.now(),
      status: GameStatus.WAITING,
    };

    await this.redisClient.hSet(gameId, gameData);
  }

  public async checkGameId(gameId: string): Promise<boolean> {
    const exists = await this.redisClient.exists(gameId);
    return exists === 1;
  }

  public async joinGame(gameId: string, newPlayer: Player): Promise<Player[]> {
    const gameData = await this.redisClient.hGetAll(gameId);

    const players: Player[] = JSON.parse(gameData.players);
    players.push(newPlayer);

    await this.redisClient.hSet(gameId, {
      ...gameData,
      players: JSON.stringify(players),
    });

    return players;
  }

  public async changePlayerName(
    gameId: string,
    userId: string,
    newName: string,
  ): Promise<Player[]> {
    const gameData = await this.redisClient.hGetAll(gameId);

    const players: Player[] = JSON.parse(gameData.players);
    const playerIndex = players.findIndex((player) => player.id === userId);

    if (playerIndex !== -1) {
      players[playerIndex].name = newName;
    }

    await this.redisClient.hSet(gameId, {
      ...gameData,
      players: JSON.stringify(players),
    });

    return players;
  }
}
