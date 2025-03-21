import { createClient, RedisClientType } from "redis";
import {
  FinishGamePayload,
  Game,
  GameResult,
  GameStatus,
  Player,
  PlayerState,
} from "../types";

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
   * Gets a game object from Redis storage by game ID.
   *
   * @param gameId - The unique identifier of the game to retrieve.
   * @returns A Promise that resolves to the Game object corresponding to the given ID.
   * @throws Error if the specified game room with that id does not exist
   */
  private async getGameObj(gameId: string): Promise<Game> {
    const roomExists = await this.redisClient.exists(`game:${gameId}`);

    if (roomExists !== 1) {
      throw new Error(`Room with ID ${gameId} does not exist`);
    }

    const game = (await this.redisClient.json.get(
      `game:${gameId}`,
    )) as unknown as Game;

    return game;
  }

  /**
   * Saves a Game object to Redis storage.
   *
   * @param gameId - The unique identifier of the game to save.
   * @param newObj - The Game object to be saved.
   * @returns A Promise that resolves when the game is successfully saved.
   */
  private async saveGameObj(gameObj: Game): Promise<void> {
    await this.redisClient.json.set(`game:${gameObj.id}`, "$", { ...gameObj });
  }

  /**
   * Gets a player object from Redis storage by player ID.
   *
   * @param playerId - The unique identifier of the player to retrieve.
   * @returns A Promise that resolves to the Player object corresponding to the given ID.
   * @throws Error if the specified player with that id does not exist
   */
  private async getPlayerObj(playerId: string): Promise<Player> {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    if (playerExists !== 1) {
      throw new Error(`Player with ID ${playerId} oes not exist`);
    }

    const player = (await this.redisClient.json.get(
      `player:${playerId}`,
    )) as unknown as Player;

    return player;
  }

  /**
   * Saves a Player object to Redis storage.
   *
   * @param playerId - The unique identifier of the player to save.
   * @param newObj - The Player object to be saved.
   * @returns A Promise that resolves when the player is successfully saved.
   */
  private async savePlayerObj(playerObj: Player): Promise<void> {
    await this.redisClient.json.set(`player:${playerObj.id}`, "$", {
      ...playerObj,
    });
  }

  /**
   * Retrieves a GameResult object from Redis storage by game ID.
   * If no game result exists for the given ID, creates a new one.
   *
   * @param gameId - The unique identifier of the game result to retrieve.
   * @returns A Promise that resolves to the GameResult object corresponding to the given ID.
   */
  private async getGameResultObj(gameId: string): Promise<GameResult> {
    const gameResultExists = await this.redisClient.exists(`gameId:${gameId}`);

    if (gameResultExists !== 1) {
      const gameResultObj: GameResult = {
        id: gameId,
        players: [],
      };

      await this.redisClient.json.set(`gameResult:${gameId}`, "$", {
        ...gameResultObj,
      });

      return gameResultObj;
    }

    const gameResultObj = (await this.redisClient.json.get(
      `gameResult:${gameId}`,
    )) as unknown as GameResult;

    return gameResultObj;
  }

  /**
   * Saves a GameResult object to Redis storage.
   *
   * @param gameResultObj - The GameResult object to be saved.
   * @returns A Promise that resolves when the game result is successfully saved.
   */
  private async saveGameResultObj(gameResultObj: GameResult): Promise<void> {
    await this.redisClient.json.set(`gameResult:${gameResultObj.id}`, "$", {
      ...gameResultObj,
    });
  }

  /**
   * Checks if a player with the given ID exists in storage.
   *
   * @param userId - The unique identifier of the user to check.
   * @returns A Promise that resolves to true if the user exists, false otherwise.
   */
  public async checkExistingPlayer(playerId: string): Promise<boolean> {
    const existingPlayer = await this.redisClient.exists(`player:${playerId}`);

    return existingPlayer === 1;
  }

  /**
   * Creates a game entry in Redis storage.
   *
   * @param game - The Game object to store.
   * @returns A Promise that resolves when the game is successfully created.
   */
  public async createGame(game: Game): Promise<void> {
    await this.saveGameObj(game);
  }

  /**
   * Updates the current game ID of a player and adds the player to the game
   *
   * @param playerId - The unique identifier of the player to update.
   * @param gameId - The new game ID to assign to the player.
   * @returns A Promise that resolves when the player's game ID is successfully updated.
   * @throws Error if the specified game or player with that id does not exist
   */
  public async updatePlayerGameId(playerId: string, gameId: string) {
    // change the currentGameId of the player
    const playerObj = await this.getPlayerObj(playerId);

    playerObj.currentGameId = gameId;

    await this.savePlayerObj(playerObj);

    // add this playerId in the game
    const gameObj = await this.getGameObj(gameId);

    gameObj.playerIds.push(playerObj.id);

    await this.saveGameObj(gameObj);
  }

  /**
   * Creates a new player in Redis storage with the specified user ID and game ID. also adds the player to the game
   *
   * @param userId - The unique identifier for the new player.
   * @param gameId - The ID of the game the player will join.
   * @returns A Promise that resolves when the player is successfully created.
   * @throws Error if the specified game with that id does not exist
   */
  public async createNewPlayer(playerId: string, gameId: string) {
    // create the player
    const newPlayerObj: Player = {
      id: playerId,
      name: playerId.substring(0, 5),
      currentGameId: gameId,
      pastResults: [],
    };

    await this.savePlayerObj(newPlayerObj);

    // add the player to the game
    const gameObj = await this.getGameObj(gameId);

    gameObj.playerIds.push(newPlayerObj.id);

    await this.saveGameObj(gameObj);
  }

  /**
   * Gets the number of players in a game room.
   *
   * @param gameId - The unique identifier of the game room to check.
   * @returns A Promise that resolves to the number of players in the room.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async getRoomSize(gameId: string): Promise<number> {
    // fetch the size of the room
    const gameObj = await this.getGameObj(gameId);

    return gameObj.playerIds.length;
  }

  /**
   * Gets player state information for a given game.
   *
   * @param gameId - The unique identifier of the game.
   * @returns A Promise that resolves to an array of PlayerState objects containing player IDs and names.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async getAllPlayers(gameId: string): Promise<PlayerState[]> {
    // fetch the game object
    const gameObj = await this.getGameObj(gameId);

    // return the player state
    const playerStates: PlayerState[] = [];

    for (const playerId of gameObj.playerIds) {
      const player = await this.getPlayerObj(playerId);

      playerStates.push({
        playerId: player.id,
        playerName: player.name,
      });
    }
    return playerStates;
  }

  /**
   * Retrieves information about a player.
   *
   * @param playerId - The unique identifier of the player.
   * @returns A Promise that resolves to a PlayerState object containing the player's ID and name.
   * @throws Error if the player with the specified ID does not exist.
   */
  public async getPlayerState(playerId: string): Promise<PlayerState> {
    // return the id and name
    const player = await this.getPlayerObj(playerId);

    return {
      playerId: player.id,
      playerName: player.name,
    };
  }

  /**
   * Changes the username of a player.
   *
   * @param playerId - The unique identifier of the player whose username should be changed.
   * @param newUsername - The new username to assign to the player.
   * @returns A Promise that resolves when the username has been successfully changed.
   * @throws Error if the player with the specified ID does not exist.
   */
  public async changeUsername(
    playerId: string,
    newUsername: string,
  ): Promise<void> {
    // fetch the player, update and save
    const playerObj = await this.getPlayerObj(playerId);

    playerObj.name = newUsername;

    await this.savePlayerObj(playerObj);
  }

  /**
   * Updates the status of a game.
   *
   * @param gameId - The unique identifier of the game to update.
   * @param newState - The new game status to set.
   * @returns A Promise that resolves when the game status has been successfully updated.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async updateGameState(gameId: string, newState: GameStatus) {
    const gameObj = await this.getGameObj(gameId);

    gameObj.status = newState;

    await this.saveGameObj(gameObj);
  }

  /**
   * Records a player's game completion data and the game result object.
   *
   * @param playerId - The unique identifier of the player who finished the game.
   * @param playerData - The payload containing the player's performance metrics.
   * @param gameId - The unique identifier of the completed game.
   * @returns A Promise that resolves when the player's completion data has been successfully stored.
   * @throws Error if the specified game or player with that id does not exist
   */
  public async finishGame(
    playerId: string,
    playerData: FinishGamePayload,
    gameId: string,
  ): Promise<void> {
    const gameResultObj = await this.getGameResultObj(gameId);

    const playerObj = await this.getPlayerObj(playerId);

    // save the info in the game result
    gameResultObj.players.push({
      id: playerObj.id,
      name: playerObj.name,
      wpm: playerData.wpm,
      accuracy: playerData.accuracy,
      time: playerData.time,
      position: gameResultObj.players.length + 1,
    });

    await this.saveGameResultObj(gameResultObj);

    // reflect this info in the player object
    playerObj.pastResults.push({
      id: gameId,
    });

    await this.savePlayerObj(playerObj);
  }

  /**
   * Checks if all players in a game have finished playing.
   *
   * @param gameId - The unique identifier of the game to check.
   * @returns A Promise that resolves to true if all players have finished, false otherwise.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async checkGameFinished(gameId: string): Promise<boolean> {
    const gameObj = await this.getGameObj(gameId);
    const gameResultObj = await this.getGameResultObj(gameId);

    return gameObj.playerIds.length === gameResultObj.players.length;
  }

  /**
   * Retrieves the game result data for a specific game.
   *
   * @param gameId - The unique identifier of the game to get results for.
   * @returns A Promise that resolves to the GameResult object containing player performance data.
   * @throws Error if the specified game with that id does not exist
   */
  public async getGameResult(gameId: string): Promise<GameResult> {
    return this.getGameResultObj(gameId);
  }
}
