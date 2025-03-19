import { createClient, RedisClientType } from "redis";
import { Game, GameStatus, Player, PlayerState } from "../types";

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
   */
  private async getGameObj(gameId: string): Promise<Game> {
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
  private async saveGameObj(gameId: string, newObj: Game): Promise<void> {
    await this.redisClient.json.set(`game:${gameId}`, "$", { ...newObj });
  }

  /**
   * Gets a player object from Redis storage by player ID.
   *
   * @param playerId - The unique identifier of the player to retrieve.
   * @returns A Promise that resolves to the Player object corresponding to the given ID.
   */
  private async getPlayerObj(playerId: string): Promise<Player> {
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
  private async savePlayerObj(playerId: string, newObj: Player): Promise<void> {
    await this.redisClient.json.set(`player:${playerId}`, "$", { ...newObj });
  }

  /**
   * Verifies that a game room exists in storage.
   *
   * @param gameId - The unique identifier of the game room to verify.
   * @returns A Promise that resolves if the game room exists.
   * @throws Error if the game room with the specified ID does not exist.
   */
  private async verifyGameRoom(gameId: string): Promise<void> {
    const roomExists = await this.redisClient.exists(`game:${gameId}`);

    if (roomExists !== 1) {
      throw new Error(`Room with ID ${gameId} does not exist`);
    }
  }

  /**
   * Verifies that a player exists in storage.
   *
   * @param playerId - The unique identifier of the player to verify.
   * @returns A Promise that resolves if the player exists.
   * @throws Error if the player with the specified ID does not exist.
   */
  private async verifyPlayer(playerId: string): Promise<void> {
    const playerExists = await this.redisClient.exists(`player:${playerId}`);

    if (playerExists !== 1) {
      throw new Error(`Player with ID ${playerId} oes not exist`);
    }
  }

  /**
   * Checks if a player with the given ID exists in storage.
   *
   * @param userId - The unique identifier of the user to check.
   * @returns A Promise that resolves to true if the user exists, false otherwise.
   */
  public async checkExistingPlayer(playerId: string): Promise<boolean> {
    try {
      await this.verifyPlayer(playerId);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Creates a game entry in Redis storage.
   *
   * @param game - The Game object to store.
   * @returns A Promise that resolves when the game is successfully created.
   */
  public async createGame(game: Game): Promise<void> {
    await this.saveGameObj(game.id, game);
  }

  /**
   * Updates the current game ID of a player and adds the player to the game
   *
   * @param playerId - The unique identifier of the player to update.
   * @param gameId - The new game ID to assign to the player.
   * @returns A Promise that resolves when the player's game ID is successfully updated.
   */
  public async updatePlayerGameId(playerId: string, gameId: string) {
    // verify playerId and gameId
    await this.verifyPlayer(playerId);
    await this.verifyGameRoom(gameId);

    // change the currentGameId of the player
    const player = await this.getPlayerObj(playerId);

    player.currentGameId = gameId;

    await this.savePlayerObj(playerId, player);

    // add this playerId in the game
    const game = await this.getGameObj(gameId);

    game.playerIds.push(player.id);

    await this.saveGameObj(gameId, game);
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

    await this.savePlayerObj(playerId, newPlayer);

    // add the player to the game
    const game = await this.getGameObj(gameId);

    game.playerIds.push(newPlayer.id);

    await this.saveGameObj(gameId, game);
  }

  /**
   * Gets the number of players in a game room.
   *
   * @param gameId - The unique identifier of the game room to check.
   * @returns A Promise that resolves to the number of players in the room.
   * @throws Error if the room with the specified ID does not exist.
   */
  public async getRoomSize(gameId: string): Promise<number> {
    await this.verifyGameRoom(gameId);

    // fetch the size of the room
    const game = await this.getGameObj(gameId);

    return game.playerIds.length;
  }

  /**
   * Gets player state information for a given game.
   *
   * @param gameId - The unique identifier of the game.
   * @returns A Promise that resolves to an array of PlayerState objects containing player IDs and names.
   * @throws Error if the room with the specified ID does not exist.
   */
  public async getAllPlayers(gameId: string): Promise<PlayerState[]> {
    // ensure that this gameRoom actually exists
    await this.verifyGameRoom(gameId);

    // fetch the game object
    const game = await this.getGameObj(gameId);

    // return the player state
    const playerStates: PlayerState[] = [];

    for (const playerId of game.playerIds) {
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
    // verify that the player exists
    await this.verifyPlayer(playerId);

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
    // verify that the user exists
    await this.verifyPlayer(playerId);

    // fetch the player, update and save
    const player = await this.getPlayerObj(playerId);

    player.name = newUsername;

    await this.savePlayerObj(playerId, player);
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
    // verify that the game exists
    await this.verifyGameRoom(gameId);

    const game = await this.getGameObj(gameId);

    game.status = newState;

    await this.saveGameObj(gameId, game);
  }
}
