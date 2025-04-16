import { FinishGamePayload, Game, GameResult, GameStatus } from "../types";
import { StorageService } from "./storageService";
import { v4 as uuid } from "uuid";

/** Manages game/player related operations */
export class GameService {
  private storageService: StorageService;

  public constructor() {
    this.storageService = StorageService.getInstance();
  }

  public async validatePlayerId(playerId: string): Promise<boolean> {
    return this.storageService.validatePlayerId(playerId);
  }

  public async getPlayerGameId(playerId: string): Promise<string | null> {
    return this.storageService.getPlayerGameId(playerId);
  }

  public async getGameStatus(gameId: string): Promise<GameStatus> {
    return this.storageService.getGameStatus(gameId);
  }

  /**
   * Removes the given player from the given game
   * @throws if the given gameId does not exist
   */
  public async removePlayerFromGame(
    playerId: string,
    gameId: string,
  ): Promise<void> {
    await this.storageService.removePlayerFromGame(playerId, gameId);
  }

  /**
   * Removes the given player from the storage
   * @throws if the player is not found
   */
  public async removePlayer(playerId: string): Promise<void> {
    return this.storageService.removePlayer(playerId);
  }

  /** Creates a new game with the specified user as host */
  public async createGame(hostId: string): Promise<string> {
    // create the new game object
    const newGame: Game = {
      id: uuid(),
      hostId,
      playerIds: [], // the current host will be added by the update/create function
      status: GameStatus.WAITING,
      gameText: "",
      createdAt: new Date(),
    };

    // store this game
    await this.storageService.createGame(newGame);

    // add the player to the game
    await this.addPlayer(hostId, newGame.id);

    return newGame.id;
  }

  /**
   * Gets the number of players in a specific game
   * @throws Error if the specified game with that id does not exist
   */
  public async getRoomSize(gameId: string): Promise<number> {
    return this.storageService.getRoomSize(gameId);
  }

  /**
   * Creates a player object if it doesn't exist and adds the player to the given gameId
   * @throws if the specified player or game with that id does not exist
   */
  public async addPlayer(playerId: string, gameId: string): Promise<void> {
    // if the user exists, then we update it or create a new one
    const userExists = await this.storageService.checkExistingPlayer(playerId);

    if (userExists) {
      // update the player object and add the userId to the game
      await this.storageService.updatePlayerGameId(playerId, gameId);
    } else {
      // or create a new player, also adding the userId to the game
      await this.storageService.createNewPlayer(playerId, gameId);
    }
  }

  /** retrieves the game lobby of the given game */
  public async getLobby(gameId: string) {
    return this.storageService.getLobby(gameId);
  }

  // FIXME
  public async getPlayerInfo(playerId: string) {
    return this.storageService.getPlayerInfo(playerId);
  }

  /**
   * Updates the player's username in the storage service
   * @throws if the specified player with that id does not exist
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
