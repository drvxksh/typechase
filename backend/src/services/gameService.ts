import { Game, GameStatus, Player } from "../types";
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
      playerIds: [hostId],
      status: GameStatus.WAITING,
      gameText: "",
      createdAt: new Date(),
    };

    // store this game
    await this.storageService.createGame(newGame);

    // check if this user exists in the store, if it does then we have to update its currentGameId
    const userExists = await this.storageService.checkExistingUser(hostId);

    if (userExists) {
      // update
      await this.storageService.updatePlayerGameId(hostId, newGame.id);
    } else {
      // or create a new player
      await this.storageService.createNewPlayer(hostId, newGame.id);
    }

    // return the gameId
    return newGame.id;
  }
}
