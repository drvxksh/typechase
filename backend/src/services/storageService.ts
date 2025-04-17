import { createClient, RedisClientType } from "redis";
import {
  FinishGamePayload,
  Game,
  GameResult,
  GameStatus,
  Player,
} from "../types";

/** Stores game/player info into redis for some persistence. */
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
   * @throws if the specified game room with that id does not exist
   */
  private async getGameObj(gameId: string): Promise<Game> {
    const roomExists = await this.redisClient.exists(`game:${gameId}`);

    if (roomExists !== 1) {
      throw new Error(`Room with ID ${gameId} does not exist`);
    }

    const game = (await this.redisClient.json.get(
      `game:${gameId}`,
    )) as unknown as Game;

    // everytime the object is accessed, refresh its expiry so that it expires after 15mins of staying idle.
    await this.redisClient.expire(`game:${gameId}`, 900);

    return game;
  }

  /**
   * Saves a Game object to Redis storage.
   * @returns A Promise that resolves when the game is successfully saved.
   */
  private async saveGameObj(gameObj: Game): Promise<void> {
    await this.redisClient.json.set(`game:${gameObj.id}`, "$", { ...gameObj });

    // update the expiry time.
    await this.redisClient.expire(`game:${gameObj.id}`, 900);
  }

  /** Removes the game object from the storage */
  private async deleteGameObj(gameId: string): Promise<void> {
    // Delete the JSON structure
    await this.redisClient.json.del(`game:${gameId}`);
    // Also delete the key itself to ensure complete cleanup
    await this.redisClient.del(`game:${gameId}`);
    console.log(`existence of ${gameId}`, await this.validateGameId(gameId));
  }

  /**
   * Gets a player object from Redis storage by player ID.
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

    // refresh the expiry of the player obj
    await this.redisClient.expire(`player:${playerId}`, 1200);

    return player;
  }

  /** Saves a Player object to Redis storage. */
  private async savePlayerObj(playerObj: Player): Promise<void> {
    await this.redisClient.json.set(`player:${playerObj.id}`, "$", {
      ...playerObj,
    });

    await this.redisClient.expire(`player:${playerObj.id}`, 1200);
  }

  /** Retrieves a GameResult obj from the storage. If no obj exists, creates a new one */
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

  /** Saves a GameResult object to Redis storage. */
  private async saveGameResultObj(gameResultObj: GameResult): Promise<void> {
    await this.redisClient.json.set(`gameResult:${gameResultObj.id}`, "$", {
      ...gameResultObj,
    });
  }

  public async validatePlayerId(playerId: string): Promise<boolean> {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    return playerExists === 1;
  }

  public async validateGameId(gameId: string): Promise<boolean> {
    const gameExists = await this.redisClient.exists(`game:${gameId}`);

    return gameExists === 1;
  }

  /**
   * Retrieves the gameId that this player is a part of
   * @throws Error if the given playerId does not exist
   */
  public async getPlayerGameId(playerId: string): Promise<string | null> {
    const playerObj = await this.getPlayerObj(playerId);

    return playerObj.currentGameId;
  }

  /**
   * Retrieves the game state of the given gameId
   * @throws Error if a game with that ID does not exist
   */
  public async getGameStatus(gameId: string): Promise<GameStatus> {
    const gameObj = await this.getGameObj(gameId);

    return gameObj.status;
  }

  /**
   * Removes the player from the game object
   * @throws Error if the given gameId does not exist
   */
  public async removePlayerFromGame(
    playerId: string,
    gameId: string,
  ): Promise<void> {
    const gameObj = await this.getGameObj(gameId);
    console.log("when removing, state of the game is", gameObj);

    // If this player was the host and there were no players, delete the Game
    if (gameObj.hostId === playerId && gameObj.playerIds.length === 1) {
      console.log("deleting the game");
      await this.deleteGameObj(gameId);
      return; // Exit early after deletion
    } else if (gameObj.hostId === playerId) {
      // otherwise make someone else the host
      gameObj.playerIds = gameObj.playerIds.filter((id) => id !== playerId);
      gameObj.hostId = gameObj.playerIds[0];
    } else {
      // else just remove the player
      gameObj.playerIds = gameObj.playerIds.filter((id) => id !== playerId);
    }

    await this.saveGameObj(gameObj);
  }

  /** Checks if the given user exists or not. */
  public async checkExistingPlayer(playerId: string): Promise<boolean> {
    const existingPlayer = await this.redisClient.exists(`player:${playerId}`);

    return existingPlayer === 1;
  }

  /** Saves the given game into the storage */
  public async createGame(game: Game): Promise<void> {
    await this.saveGameObj(game);
  }

  /**
   * Updates the current game for the player while adding the player to the game as well
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
    console.log("updated a playerId");

    await this.saveGameObj(gameObj);
  }

  /**
   * Creates a new player instance and saves it while updating the game data as well.
   * @throws Error if the specified game with that id does not exist
   */
  public async createNewPlayer(playerId: string, gameId: string) {
    // create the player
    const newPlayerObj: Player = {
      id: playerId,
      name: playerId.substring(0, 5),
      currentGameId: gameId,
    };

    await this.savePlayerObj(newPlayerObj);

    // add the player to the game
    const gameObj = await this.getGameObj(gameId);

    gameObj.playerIds.push(newPlayerObj.id);
    console.log("added a new player to the game");

    await this.saveGameObj(gameObj);
  }

  /**
   * Gets the number of players in a game room.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async getRoomSize(gameId: string): Promise<number> {
    // fetch the size of the room
    const gameObj = await this.getGameObj(gameId);

    return gameObj.playerIds.length;
  }

  /**
   *Retrieves the game lobby of the given game
   * @throws if the gameId is not of an existing game
   */
  public async getLobby(gameId: string) {
    const gameObj = await this.getGameObj(gameId);

    let players = [];

    for (const playerId of gameObj.playerIds) {
      const playerObj = await this.getPlayerObj(playerId);
      players.push({ playerId: playerObj.id, playerName: playerObj.name });
    }

    return {
      hostId: gameObj.hostId,
      players,
    };
  }

  /**
   * Retrieves information about a player.
   * @throws Error if the player with the specified ID does not exist.
   */
  public async getPlayerInfo(playerId: string) {
    // return the id and name
    const player = await this.getPlayerObj(playerId);

    return {
      playerId: player.id,
      playerName: player.name,
    };
  }

  /**
   * Changes the username of a player.
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
   * @throws Error if the game with the specified ID does not exist.
   */
  public async updateGameState(gameId: string, newState: GameStatus) {
    const gameObj = await this.getGameObj(gameId);

    gameObj.status = newState;

    await this.saveGameObj(gameObj);
  }

  /**
   * Records a player's game completion data and the game result object.
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

    await this.savePlayerObj(playerObj);
  }

  /**
   * Checks if all players in a game have finished playing.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async checkGameFinished(gameId: string): Promise<boolean> {
    const gameObj = await this.getGameObj(gameId);
    const gameResultObj = await this.getGameResultObj(gameId);

    return gameObj.playerIds.length === gameResultObj.players.length;
  }

  /**
   * Retrieves the game result data for a specific game.
   * @throws Error if the specified game with that id does not exist
   */
  public async getGameResult(gameId: string): Promise<GameResult> {
    return this.getGameResultObj(gameId);
  }
}
