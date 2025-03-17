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
}
