// import { loremIpsum } from "lorem-ipsum";
import { v4 as uuid } from "uuid";
import {
  FinishGamePayload,
  Game,
  GameInfo,
  GameResult,
  GameStatus,
  Player,
} from "../types";
import { StorageService } from "./storageService";

/** Manages game/player related operations */
export class GameService {
  private storageService: StorageService;

  public constructor() {
    this.storageService = StorageService.getInstance();
  }

  /**
   * Removes the given player from the given game and returns the updated hostId.
   * @throws if the given gameId does not exist
   */
  public async removePlayerFromGame(
    playerId: string | undefined,
    gameId: string | undefined,
  ) {
    // if the player was a part of the game, remove it.
    if (playerId && gameId) {
      const gameObj = await this.storageService.getGameObj(gameId);

      // the host is the only player of the game
      if (gameObj.hostId === playerId && gameObj.playerIds.length === 1) {
        await this.storageService.deleteGameObj(gameId);
        return null;
      } else if (gameObj.hostId === playerId) {
        // there are other players in the game other than the host
        gameObj.playerIds = gameObj.playerIds.filter((id) => id !== playerId);
        gameObj.hostId = gameObj.playerIds[0]; // reassign the host
      } else {
        // any other player but not the host
        gameObj.playerIds = gameObj.playerIds.filter((id) => id !== playerId);
      }

      await this.storageService.saveGameObj(gameObj);

      // return the updated host of the game.
      return gameObj.hostId;
    }

    return null;
  }

  /** Validates whether the given playerId exists or not */
  public async validatePlayerId(playerId: string) {
    return this.storageService.validatePlayerId(playerId);
  }

  /** Validates whether the given gameId exists or not */
  public async validateGameId(gameId: string) {
    return this.storageService.validateGameId(gameId);
  }

  /** Validates whether the given gameResultId exists or not */
  public async validateGameResultId(gameResultId: string) {
    return this.storageService.validateGameResultId(gameResultId);
  }

  /** Returns the gameId and gameStatus for the game the give player is a part of. Returns null values otherwise */
  public async getGameInfo(playerId: string) {
    const gameInfo: GameInfo = {
      gameId: null,
      gameStatus: null,
    };

    const validPlayer = await this.storageService.validatePlayerId(playerId);

    if (validPlayer) {
      const playerObj = await this.storageService.getPlayerObj(playerId);
      const gameId = playerObj.currentGameId;

      if (!gameId) {
        // the player wasn't a part of any game.
        return gameInfo;
      }

      const validGameId = await this.storageService.validateGameId(gameId);

      if (!validGameId) {
        // the game doesn't exist now, update the playerObj
        playerObj.currentGameId = null;

        await this.storageService.savePlayerObj(playerObj);

        return gameInfo;
      } else {
        const gameObj = await this.storageService.getGameObj(gameId);

        gameInfo.gameId = gameId;
        gameInfo.gameStatus = gameObj.status;

        return gameInfo;
      }
    }

    console.warn("Fetching game info for an invalid player");
    return gameInfo;
  }

  /**
   * Adds an existing user to a game. Updates its currentGameId and pushes the player to the game.
   * @throws if the playerId or gameId do not exist
   */
  private async updateGamePlayer(playerId: string, gameId: string) {
    // update the gameId for the player
    const playerObj = await this.storageService.getPlayerObj(playerId);

    playerObj.currentGameId = gameId;

    await this.storageService.savePlayerObj(playerObj);

    // add the player to the game
    const gameObj = await this.storageService.getGameObj(gameId);

    gameObj.playerIds.push(playerObj.id);

    await this.storageService.saveGameObj(gameObj);
  }

  /**
   * Creates a new player and adds it to the game.
   * @throws if the given gameId does not exist.
   */
  private async createGamePlayer(playerId: string, gameId: string) {
    // add the player to the game.
    const gameObj = await this.storageService.getGameObj(gameId);

    gameObj.playerIds.push(playerId);

    await this.storageService.saveGameObj(gameObj);

    // create the player with the given id
    const newPlayer: Player = {
      id: playerId,
      name: "player-" + playerId.substring(0, 5),
      currentGameId: gameId,
    };

    await this.storageService.savePlayerObj(newPlayer);
  }

  /** Updates the gameId of the player and adds the player to the game */
  public async rejoinPlayer(playerId: string, gameId: string) {
    // as the player is rejoining, the earlier checks would have ensured the validity of the player. Hence, it can safely be updated directly

    await this.updateGamePlayer(playerId, gameId);
  }

  /** Returns the basic info of the given playerId if valid, null otherwise */
  public async getPlayerInfo(playerId: string) {
    const validPlayer = await this.validatePlayerId(playerId);

    if (validPlayer) {
      const player = await this.storageService.getPlayerObj(playerId);

      return { playerId: player.id, playerName: player.name };
    }

    console.warn("Fetching player info for an invalid player");
    return null;
  }

  /** Creates a new game with the specified user as host */
  public async createGame(hostId: string) {
    // create the new game object
    const newGame: Game = {
      id: uuid(),
      hostId,
      playerIds: [], // the current host will be added by the addPlayer function
      status: GameStatus.WAITING,
      gameText: "",
      createdAt: new Date(),
    };

    // store this game
    await this.storageService.saveGameObj(newGame);

    // add the player to the game
    await this.addPlayer(hostId, newGame.id);

    return newGame.id;
  }

  /**
   * Creates a player object if it doesn't exist and adds the player to the given gameId
   */
  public async addPlayer(playerId: string, gameId: string) {
    // if the user exists, then we update it or create a new one
    const userExists = await this.storageService.validatePlayerId(playerId);

    if (userExists) {
      // update the player object and add the userId to the game
      await this.updateGamePlayer(playerId, gameId);
    } else {
      // or create a new player, also adding the userId to the game
      await this.createGamePlayer(playerId, gameId);
    }
  }

  /** Returns the number of players in the given gameId if valid, null otherwise */
  public async getRoomSize(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);

      return gameObj.playerIds.length;
    }

    console.warn("Fetching room size for an invalid game");
    return null;
  }

  public async getHostId(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);

      return gameObj.hostId;
    }

    console.warn("Fetching the host id for an invalid game");
    return null;
  }

  /** Returns the lobby for a given game. Null if the game is invalid */
  public async getLobby(gameId: string) {
    // ensure that the given gameId is valid
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      // gather the details
      const gameObj = await this.storageService.getGameObj(gameId);

      let players = [];

      for (const playerId of gameObj.playerIds) {
        const playerObj = await this.storageService.getPlayerObj(playerId);

        players.push({
          playerId: playerObj.id,
          playerName: playerObj.name,
        });
      }
      return {
        hostId: gameObj.hostId,
        players,
      };
    }

    console.warn("Fetching lobby for an invalid game");
    return null; // when the game was invalid
  }

  /** Updates the player's username in the storage service. Returns true if it was successfully updated, false otherwise */
  public async changeUsername(playerId: string, newUsername: string) {
    // validate the incoming playerId.
    const validPlayerId = await this.validatePlayerId(playerId);

    if (validPlayerId) {
      const playerObj = await this.storageService.getPlayerObj(playerId);

      playerObj.name = newUsername;

      await this.storageService.savePlayerObj(playerObj);

      return true;
    } else {
      console.error("Changing username of an invalid player");
      return false;
    }
  }

  /** Updates the game status. Returns true if successfull, false otherwise */
  public async updateGameStatus(gameId: string, newState: GameStatus) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);

      gameObj.status = newState;

      // if the game is starting, add the game text.
      if (newState === GameStatus.STARTING) {
        // const gameText = loremIpsum({
        //   count: 1,
        //   units: "sentences",
        //   sentenceLowerBound: 5,
        //   sentenceUpperBound: 15,
        //   format: "plain",
        // });

        gameObj.gameText = "asdf";
        // gameObj.gameText = gameText.trim(); // avoid any spaces at the ends
      }

      await this.storageService.saveGameObj(gameObj);

      return true;
    }

    console.warn("Updating the game status of an invalid game");
    return false;
  }

  /** Returns the game text for a give gameId if valid, null otherwise */
  public async getGameText(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);
      return gameObj.gameText;
    }

    console.warn("Fetching the game text for an invalid game");
    return null;
  }

  /** Returns the game players with the initial position. */
  public async getGamePlayers(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);

      let players = [];

      for (const playerId of gameObj.playerIds) {
        const playerObj = await this.storageService.getPlayerObj(playerId);

        players.push({
          playerId: playerObj.id,
          playerName: playerObj.name,
          position: 0,
        });
      }

      return players;
    } else {
      console.warn("Fetching the game players for an invalid game");
      return null;
    }
  }

  /** Adds a player to the gameResult object after it finished the game. */
  public async finishGame(
    playerId: string,
    playerData: FinishGamePayload,
    gameId: string,
  ) {
    const validPlayer = await this.validatePlayerId(playerId);
    const validGameId = await this.validateGameId(gameId);

    if (!validPlayer) {
      console.warn("Invalid player finishing the game");
      return;
    }

    if (!validGameId) {
      console.warn("Invalid game is being finished");
      return;
    }

    const gameResultExists =
      await this.storageService.validateGameResultId(gameId);

    let gameResultObj: GameResult;

    if (gameResultExists) {
      // fetch the existing gameResultObj
      gameResultObj = await this.storageService.getGameResultObj(gameId);
    } else {
      // create a new one
      gameResultObj = {
        id: gameId,
        players: [],
      };
    }

    // add the player to the object
    const playerObj = await this.storageService.getPlayerObj(playerId);

    gameResultObj.players.push({
      id: playerObj.id,
      name: playerObj.name,
      wpm: playerData.wpm,
      accuracy: playerData.accuracy,
      time: playerData.time,
      position: gameResultObj.players.length + 1,
    });

    // save the new object
    await this.storageService.saveGameResultObj(gameResultObj);
  }

  /** Checks if all players in a game have finished */
  public async checkAllPlayersFinished(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (validGameId) {
      const gameObj = await this.storageService.getGameObj(gameId);
      const gameResultObj = await this.storageService.getGameResultObj(gameId);

      return gameObj.playerIds.length === gameResultObj.players.length;
    }

    console.warn("Checking the player finishing status for an invalid game");
    return false;
  }

  /** Updates the gameObj for the given gameId as COMPLETED. */
  public async markGameFinished(gameId: string) {
    const validGameId = await this.validateGameId(gameId);

    if (!validGameId) {
      console.warn("An invalid game cannot be marked finished");
      return;
    }

    const gameObj = await this.storageService.getGameObj(gameId);

    gameObj.status === GameStatus.COMPLETED;

    await this.storageService.saveGameObj(gameObj);
  }

  /**
   * Retrieves the final game results including player scores and statistics
   * @throws if the gameId is invalid
   */
  public async getGameResult(gameId: string) {
    const validGameResultId = await this.validateGameResultId(gameId);

    if (validGameResultId) {
      const gameResultObj = await this.storageService.getGameResultObj(gameId);

      return gameResultObj.players;
    }

    console.warn("Fetching an invalid game result");
    return null;
  }

  public async restartGame(gameId: string) {
    // create the new game from the existing one
    const existingGameObj = await this.storageService.getGameObj(gameId);

    const newGame: Game = {
      id: uuid(),
      hostId: existingGameObj.hostId,
      playerIds: existingGameObj.playerIds,
      status: GameStatus.WAITING,
      gameText: "",
      createdAt: new Date(),
    };

    // delete the old game object
    await this.storageService.deleteGameObj(existingGameObj.id);

    // save the game and return the new gameId
    await this.storageService.saveGameObj(newGame);

    return newGame.id;
  }
}
