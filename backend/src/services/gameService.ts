import { Player } from "../types";
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

  public async createGameRoom(hostId: string): Promise<string> {
    const host: Player = {
      id: hostId,
      name: `Player_${hostId.substring(0, 5)}`,
    };

    const newGameId = uuid();

    const gameText = "";

    await this.storageService.addGame(newGameId, gameText, host);

    return newGameId;
  }
}
