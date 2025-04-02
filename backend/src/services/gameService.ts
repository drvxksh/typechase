import {
  FinishGamePayload,
  Game,
  GameResult,
  GameStatus,
  Player,
  PlayerState,
} from "../types";
import { StorageService } from "./storageService";
import { v4 as uuid } from "uuid";

/**
 * Manages game/player related operations
 */
export class GameService {
  private storageService: StorageService;

  public constructor() {
    this.storageService = StorageService.getInstance();
  }

  public async getPlayerGameId(playerId: string): Promise<string | null> {
    return this.storageService.getPlayerGameId(playerId);
  }

  public async getGameState(gameId: string): Promise<GameStatus> {
    return this.storageService.getGameState(gameId);
  }

  /**
   * Removes the given player from the given game
   * @param playerId
   * @param gameId
   * @returns a promise when the player has been successfully removed
   */
  public async removePlayerFromGame(
    playerId: string,
    gameId: string,
  ): Promise<void> {
    await this.storageService.removePlayerFromGame(playerId, gameId);
  }

  /**
   * Marks the given player as offline
   * @param playerId
   * @returns a promise that is resolved when the player has been successfully marked offline
   * @throws Error if the player is not found
   */
  public async markPlayerOffline(playerId: string): Promise<void> {
    return this.storageService.markPlayerOffline(playerId);
  }

  /**
   * Returns the status of the given player
   * @param playerId
   * @returns "offline" or "online" based on the state of the player
   * @throws Error if the player is not found
   */
  public async getPlayerStatus(
    playerId: string,
  ): Promise<"offline" | "online"> {
    return this.storageService.getPlayerStatus(playerId);
  }

  /**
   * Removes the given player from the system
   * @param playerId
   * @returns a promise that is resolved when the player has been successfully removed
   * @throws Error if the player is not found
   */
  public async removePlayer(playerId: string): Promise<void> {
    return this.storageService.removePlayer(playerId);
  }

  /**
   * Marks the given player as online
   * @param playerId
   * @returns a promise that is resolved when the player has been successfully removed
   * @throws Error if the player is not found
   */
  public async markPlayerOnline(playerId: string): Promise<void> {
    return this.storageService.markPlayerOnline(playerId);
  }

  /**
   * Creates a new game with the specified user as host
   * @param hostId The unique identifier of the host player
   * @returns A Promise resolving to the newly created game's ID
   */
  public async createGame(hostId: string): Promise<string> {
    // create the new game object
    const newGame: Game = {
      id: uuid(),
      hostId,
      playerIds: [], // the current host will be added by the update/create services
      status: GameStatus.WAITING,
      gameText: "",
      createdAt: new Date(),
    };

    // store this game
    await this.storageService.createGame(newGame);

    // add the player to the game
    await this.addPlayer(hostId, newGame.id);

    // return the gameId
    return newGame.id;
  }

  /**
   * Gets the number of players in a specific game
   * @param gameId The unique identifier of the room
   * @returns A Promise resolving to the number of players in the room
   * @throws Error if the specified game with that id does not exist
   */
  public async getRoomSize(gameId: string): Promise<number> {
    return this.storageService.getRoomSize(gameId);
  }

  /**
   * Creates a player object if it doesn't exist and adds the player to the given gameId
   * @param playerId The unique identifier of the player to add
   * @param gameId The unique identifier of the game to add the player to
   * @returns A Promise that resolves when the player has been added to the game
   * @throws Error if the specified player or game with that id does not exist
   */
  public async addPlayer(playerId: string, gameId: string): Promise<void> {
    // check if this user exists in the store, if it does then we have to update its currentGameId
    const userExists = await this.storageService.checkExistingPlayer(playerId);

    if (userExists) {
      // update the player object and add the userId to the game
      await this.storageService.updatePlayerGameId(playerId, gameId);
    } else {
      // or create a new player, also adding the userId to the game
      await this.storageService.createNewPlayer(playerId, gameId);
    }
  }

  /**
   * Retrieves the player states (IDs and names) for all players in a game
   * @param gameId The unique identifier of the game
   * @returns A Promise resolving to an array of PlayerState objects containing player IDs and names
   * @throws Error if the specified game with that id does not exist
   */
  public async getAllPlayers(gameId: string): Promise<PlayerState[]> {
    return this.storageService.getAllPlayers(gameId);
  }

  /**
   * Retrieves the player state(ID and name) for the required player
   * @param playerId The unique identifier of the player
   * @returns A Promise resolving to an array of PlayerState objects containing player IDs and names
   * @throws Error if the specified player with that id does not exist
   */
  public async getPlayerState(playerId: string): Promise<PlayerState> {
    return this.storageService.getPlayerState(playerId);
  }

  /**
   * Updates the player's username in the storage service
   * @param playerId The unique identifier of the player whose username will be changed
   * @param newUsername The new username to assign to the player
   * @returns A Promise that resolves when the username has been successfully updated
   * @throws Error if the specified player with that id does not exist
   */
  public async changeUsername(
    playerId: string,
    newUsername: string,
  ): Promise<void> {
    return this.storageService.changeUsername(playerId, newUsername);
  }

  /**
   * Updates the status of a specific game
   * @param gameId The unique identifier of the game to update
   * @param newState The new GameStatus to assign to the game
   * @returns A Promise that resolves when the game state has been successfully updated
   * @throws Error if the specified game with that id does not exist
   */
  public async updateGameState(
    gameId: string,
    newState: GameStatus,
  ): Promise<void> {
    return this.storageService.updateGameState(gameId, newState);
  }

  /**
   * Marks a game as finished for a player with the provided data
   * @param playerId The unique identifier of the player who finished
   * @param playerData The finish game data including WPM, accuracy, etc.
   * @param gameId The unique identifier of the game
   * @returns A Promise that resolves when the game has been marked as finished for the player
   * @throws Error if the specified game with that id does not exist
   */
  public finishGame(
    playerId: string,
    playerData: FinishGamePayload,
    gameId: string,
  ): Promise<void> {
    return this.storageService.finishGame(playerId, playerData, gameId);
  }

  /**
   * Checks if all players in a game have finished
   * @param gameId The unique identifier of the game to check
   * @returns A Promise resolving to a boolean indicating whether all players have finished the game
   * @throws Error if the specified game with that id does not exist
   */
  public checkGameFinished(gameId: string): Promise<boolean> {
    return this.storageService.checkGameFinished(gameId);
  }

  /**
   * Retrieves the final game results including player scores and statistics
   * @param gameId The unique identifier of the game to get results for
   * @returns A Promise resolving to a GameResult object containing player scores and performance data
   * @throws Error if the specified game with that id does not exist
   */
  public getGameResult(gameId: string): Promise<GameResult> {
    return this.storageService.getGameResult(gameId);
  }
}
