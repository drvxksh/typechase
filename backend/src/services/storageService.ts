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
  public static getInstance() {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }

    return StorageService.instance;
  }

  /**
   * Returns the game object for a given gameId. refreshes its TTL (time to live)
   * @throws if the specified game room with that id does not exist
   */
  private async getGameObj(gameId: string) {
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
   * Saves a given game object and refreshes its TTL
   * @returns A Promise that resolves when the game is successfully saved.
   */
  private async saveGameObj(gameObj: Game) {
    await this.redisClient.json.set(`game:${gameObj.id}`, "$", { ...gameObj });

    // update the expiry time.
    await this.redisClient.expire(`game:${gameObj.id}`, 900);
  }

  /** Deletes a game obj */
  private async deleteGameObj(gameId: string) {
    await this.redisClient.json.del(`game:${gameId}`);
  }

  /**
   * Returns a player object for a given playerId and refreshes its TTL.
   * @throws Error if the specified player with that id does not exist
   */
  private async getPlayerObj(playerId: string) {
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

  /** Saves a Player object and refreshes its TTL */
  private async savePlayerObj(playerObj: Player) {
    await this.redisClient.json.set(`player:${playerObj.id}`, "$", {
      ...playerObj,
    });

    await this.redisClient.expire(`player:${playerObj.id}`, 1200);
  }

  // TODO set a TTL to this
  /** Fetches a game result object. Creates a new one if the specified gameId was not found */
  private async getGameResultObj(gameId: string) {
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

  /** Saves a GameResult object */
  private async saveGameResultObj(gameResultObj: GameResult) {
    await this.redisClient.json.set(`gameResult:${gameResultObj.id}`, "$", {
      ...gameResultObj,
    });
  }

  /** Verifies whether a given playerId exists or not */
  public async validatePlayerId(playerId: string) {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    return playerExists === 1;
  }

  /** Verifies whether a given gameId exists or not */
  public async validateGameId(gameId: string) {
    const gameExists = await this.redisClient.exists(`game:${gameId}`);

    return gameExists === 1;
  }

  /**
   * Returns the gameId and status that this playerId is a part of. Returns null if the player was not a part of any Game
   * @throws if the playerId does not exist
   */
  public async getGameInfo(playerId: string) {
    const playerObj = await this.getPlayerObj(playerId);

    if (!playerObj.currentGameId) {
      return { gameId: null, gameStatus: null };
    }

    const gameObj = await this.getGameObj(playerObj.currentGameId);

    return {
      gameId: gameObj.id,
      gameStatus: gameObj.status,
    };
  }

  /**
   * Removes the player from the game object and changes the host.
   * @throws Error if the given gameId does not exist
   */
  public async removePlayerFromGame(playerId: string, gameId: string) {
    const gameObj = await this.getGameObj(gameId);

    // If this player was the host and there were no players, delete the Game
    if (gameObj.hostId === playerId && gameObj.playerIds.length === 1) {
      await this.deleteGameObj(gameId);
      return;
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

  /** Saves the given game object */
  public async createGame(game: Game) {
    await this.saveGameObj(game);
  }

  /**
   * Updates the current game for the player. Also adds the player to its corresponding game
   * @throws if the specified game or player with that id does not exist
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
   * Creates a new player instance and saves. Adds the player to its corresponding game as well.
   * @throws if the specified game with that id does not exist
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

    await this.saveGameObj(gameObj);
  }

  /**
   * Returns the number of players in the game room.
   * @throws if the game with the specified ID does not exist.
   */
  public async getRoomSize(gameId: string) {
    // fetch the size of the room
    const gameObj = await this.getGameObj(gameId);

    return gameObj.playerIds.length;
  }

  /**
   * Returns the game lobby for a given game
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
   * Returns the basic info for a given playerId
   * @throws if the player with the specified ID does not exist.
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
  public async changeUsername(playerId: string, newUsername: string) {
    // fetch the player, update and save
    const playerObj = await this.getPlayerObj(playerId);

    playerObj.name = newUsername;

    await this.savePlayerObj(playerObj);
  }

  /**
   * Updates the status of a game.
   * @throws Error if the game with the specified ID does not exist.
   */
  public async updateGameStatus(gameId: string, newState: GameStatus) {
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
