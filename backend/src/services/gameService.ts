import { Game, GameStatus, Player, PlayerState } from "../types";
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
   */
  public async getRoomSize(gameId: string): Promise<number> {
    return this.storageService.getRoomSize(gameId);
  }

  /**
   * Creates a player object if it doesn't exist and adds the player to the given gameId
   * @param playerId The unique identifier of the player to add
   * @param gameId The unique identifier of the game to add the player to
   * @returns A Promise that resolves when the player has been added to the game
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
   */
  public async getAllPlayers(gameId: string): Promise<PlayerState[]> {
    return this.storageService.getAllPlayers(gameId);
  }

  /**
   * Retrieves the player state(ID and name) for the required player
   * @param playerId The unique identifier of the player
   * @returns A Promise resolving to an array of PlayerState objects containing player IDs and names
   */
  public async getPlayerState(playerId: string): Promise<PlayerState> {
    return this.storageService.getPlayerState(playerId);
  }

  /**
   * Updates the player's username in the storage service
   * @param playerId The unique identifier of the player whose username will be changed
   * @param newUsername The new username to assign to the player
   * @returns A Promise that resolves when the username has been successfully updated
   */
  public async changeUsername(
    playerId: string,
    newUsername: string,
  ): Promise<void> {
    return this.storageService.changeUsername(playerId, newUsername);
  }
}
