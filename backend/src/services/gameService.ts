import { loremIpsum } from "lorem-ipsum";
import { FinishGamePayload, Game, GameResult, GameStatus } from "../types";
import { StorageService } from "./storageService";
import { v4 as uuid } from "uuid";

/** Manages game/player related operations */
export class GameService {
  private storageService: StorageService;

  public constructor() {
    this.storageService = StorageService.getInstance();
  }

  /** Validates whether the given playerId exists or not */
  public async validatePlayerId(playerId: string) {
    return this.storageService.validatePlayerId(playerId);
  }

  /** Validates whether the given gameId exists or not */
  public async validateGameId(gameId: string) {
    return this.storageService.validateGameId(gameId);
  }

  /**
   * Returns the gameId and status for the given playerId
   * @throws if the given playerId has no user or the player has an invalid gameId
   */
  public async getGameInfo(playerId: string) {
    return this.storageService.getGameInfo(playerId);
  }

  /**
   * Removes the given player from the given game
   * @throws if the given gameId does not exist
   */
  public async removePlayerFromGame(playerId: string, gameId: string) {
    return this.storageService.removePlayerFromGame(playerId, gameId);
  }

  /** Creates a new game with the specified user as host */
  public async createGame(hostId: string) {
    const gameText = loremIpsum({
      count: 3,
      units: "sentences",
      sentenceLowerBound: 5,
      sentenceUpperBound: 15,
      format: "plain",
    });

    // create the new game object
    const newGame: Game = {
      id: uuid(),
      hostId,
      playerIds: [], // the current host will be added by the addPlayer function
      status: GameStatus.WAITING,
      gameText,
      createdAt: new Date(),
    };

    // store this game
    await this.storageService.createGame(newGame);

    // add the player to the game
    await this.addPlayer(hostId, newGame.id);

    return newGame.id;
  }

  /**
   * Returns the number of players in the given gameId
   * @throws Error if the specified game with that id does not exist
   */
  public async getRoomSize(gameId: string) {
    return this.storageService.getRoomSize(gameId);
  }

  /**
   * Creates a player object if it doesn't exist and adds the player to the given gameId
   * @throws if the specified player or game with that id does not exist
   */
  public async addPlayer(playerId: string, gameId: string) {
    // if the user exists, then we update it or create a new one
    const userExists = await this.storageService.validatePlayerId(playerId);

    if (userExists) {
      // update the player object and add the userId to the game
      await this.storageService.updatePlayerGameId(playerId, gameId);
    } else {
      // or create a new player, also adding the userId to the game
      await this.storageService.createNewPlayer(playerId, gameId);
    }
  }

  /**
   * Returns the game lobby of the given game
   * @throws if a player with the given playerId does not exist
   */
  public async getLobby(gameId: string) {
    return this.storageService.getLobby(gameId);
  }

  /**
   * Returns the basic info of the given playerId
   * @throws if a player with the given playerId does not exist.
   */
  public async getPlayerInfo(playerId: string) {
    return this.storageService.getPlayerInfo(playerId);
  }

  /**
   * Updates the player's username in the storage service
   * @throws if the specified player with that id does not exist
   */
  public async changeUsername(playerId: string, newUsername: string) {
    return this.storageService.changeUsername(playerId, newUsername);
  }

  /**
   * Updates the status of a specific game
   * @param gameId The unique identifier of the game to update
   * @param newState The new GameStatus to assign to the game
   * @returns A Promise that resolves when the game state has been successfully updated
   * @throws Error if the specified game with that id does not exist
   */
  public async updateGameStatus(
    gameId: string,
    newState: GameStatus,
  ): Promise<void> {
    return this.storageService.updateGameStatus(gameId, newState);
  }

  public async getGameText(gameId: string) {
    return this.storageService.getGameText(gameId);
  }

  public async getGamePlayers(gameId: string) {
    return this.storageService.getGamePlayers(gameId);
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

  public markGameFinished(gameId: string) {
    return this.storageService.markGameFinished(gameId);
  }

  /**
   * Retrieves the final game results including player scores and statistics
   * @param gameId The unique identifier of the game to get results for
   * @returns A Promise resolving to a GameResult object containing player scores and performance data
   * @throws Error if the specified game with that id does not exist
   */
  public getGameResult(gameId: string) {
    return this.storageService.getGameResult(gameId);
  }

  public restartGame(gameId: string) {
    return this.storageService.restartGame(gameId);
  }
}
