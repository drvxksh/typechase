import http from "http";
import { createClient, RedisClientType } from "redis";
import { v4 as uuid } from "uuid";
import WebSocket from "ws";
import {
  BroadcastEvent,
  GameStatus,
  MAX_SIZE,
  MessageEvent,
  MIN_SIZE,
  NewPlayerInfo,
  WebSocketMessage,
} from "../types";
import { GameService } from "./gameService";
import { LoggingService } from "./loggingService";
import "dotenv/config";
import invariant from "tiny-invariant";

/**
 * Manages the communication to the client.
 * Uses websockets and redis queues
 */
export class CommunicationService {
  private static instance: CommunicationService;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  private gameService: GameService;
  private wss: WebSocket.Server;
  private clientSubscriptions: Map<string, WebSocket[]>; // used to track the channel and its clients for this instance
  private clientPlayerIds: Map<WebSocket, string>;
  private clientGameIds: Map<WebSocket, string>;
  private logger = LoggingService.getInstance();

  private constructor(server: http.Server) {
    invariant(
      process.env.REDIS_HOST,
      "Missing REDIS_HOST in the communicaiton service, did you set up the env?",
    );
    invariant(
      process.env.REDIS_PORT,
      "Missing REDIS_PORT in the communicaiton service, did you set up the env?",
    );

    // instantiate all the services
    this.pubClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });
    this.subClient = this.pubClient.duplicate();
    this.gameService = new GameService();
    this.wss = new WebSocket.Server({ server });
    this.clientSubscriptions = new Map();
    this.clientGameIds = new Map();
    this.clientPlayerIds = new Map();

    Promise.all([this.pubClient.connect(), this.subClient.connect()])
      .then(() => {
        this.logger.info("Pub-Sub clients connected");
      })
      .catch((err) =>
        this.logger.error(`Pub-Sub client connection error: ${err}`),
      );

    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("error", (err) => {
        this.logger.error(`Websocket error: ${err}`);
        this.sendError(ws, "Server closed the connection unexpectedly");
      });

      ws.on("close", async () => {
        const playerId = this.clientPlayerIds.get(ws);
        const gameId = this.clientGameIds.get(ws);

        if (gameId) {
          let updatedHostId = null;

          // unsubscribe the client from the game
          await this.unsubscribeFromGame(ws);

          try {
            // remove the player from the game and fetch the updated host id (if the player was a part of any game).
            updatedHostId = await this.gameService.removePlayerFromGame(
              playerId,
              gameId,
            );
          } catch (err) {
            LoggingService.getInstance().error(
              `Couldn't remove the player from the game while closing the connection: ${err}`,
            );
          }

          if (updatedHostId) {
            // if there have been any updates, notify others.
            await this.pubClient.publish(
              `game:${gameId}`,
              JSON.stringify({
                event: BroadcastEvent.PLAYER_LEFT,
                payload: {
                  updatedHostId,
                  playerId,
                },
              }),
            );
          }
        }
      });

      ws.on("message", async (message: string) => {
        let data = null;

        try {
          data = JSON.parse(message);
        } catch (err) {
          LoggingService.getInstance().error(
            `Unknown format for messaging: ${err}`,
          );

          this.sendError(
            ws,
            "Invalid message format received. Please check your request.",
          );
        }

        if (data) {
          await this.processMessage(ws, data);
        }
      });
    });
  }

  /** Sends an error message to the client via websockets */
  private sendError(client: WebSocket, errorMessage: string): void {
    this.send(client, {
      event: MessageEvent.ERROR,
      payload: { message: errorMessage },
    });
  }

  /** Sends the message to the client via websockets if the connection is open */
  private send(client: WebSocket, message: WebSocketMessage) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /** Creates a new insatnce if not already present */
  public static initialize(server: http.Server): void {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService(server);
    }
  }

  /** Redirects the incoming event to its respective handler */
  private async processMessage(
    client: WebSocket,
    message: WebSocketMessage,
  ): Promise<void> {
    if (!message || !message.event || !message.payload) {
      const missingField = !message
        ? "message"
        : !message.event
          ? "event"
          : "payload";
      this.logger.warn(
        `Incomplete message received: ${missingField} is missing`,
      );
      this.sendError(
        client,
        `The request is incomplete. Missing field: ${missingField}.`,
      );
      return;
    }

    const { event, payload } = message;

    switch (event) {
      case MessageEvent.HEALTH_CHECK:
        await this.handleHealthCheck(client);
        break;
      case MessageEvent.CONNECT:
        await this.handleConnect(client, payload);
        break;
      case MessageEvent.CREATE_GAME:
        this.handleCreateGame(client);
        break;
      case MessageEvent.JOIN_GAME:
        this.handleJoinGame(client, payload);
        break;
      case MessageEvent.CHECK_GAME_ID:
        this.handleCheckGameId(client, payload);
        break;
      case MessageEvent.GET_LOBBY:
        this.handleGetLobby(client);
        break;
      case MessageEvent.CHANGE_USERNAME:
        this.handleChangeUsername(client, payload);
        break;
      case MessageEvent.START_GAME:
        this.handleStartGame(client);
        break;
      case MessageEvent.GET_GAME_TEXT:
        this.handleGetGameText(client);
        break;
      case MessageEvent.GET_GAME_PLAYERS:
        this.handleGetGamePlayers(client);
        break;
      case MessageEvent.PLAYER_UPDATE:
        this.handlePlayerUpdate(client, payload);
        break;
      case MessageEvent.FINISH_GAME:
        this.handleFinishGame(client, payload);
        break;
      case MessageEvent.GET_GAME_RESULT:
        this.handleGetGameResult(client);
        break;
      case MessageEvent.RESTART_GAME:
        this.handleRestartGame(client);
        break;
      case MessageEvent.LEAVE_GAME:
        this.handleLeaveGame(client);
        break;
      case MessageEvent.REJOIN_GAME:
        this.handleRejoinGame(client);
        break;
      case MessageEvent.CANCEL_REJOIN:
        this.handleCancelRejoin(client);
        break;
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
        break;
    }
  }

  /** Handles the health check request from a client. Sends a message to confirm that the connection is alive */
  private async handleHealthCheck(client: WebSocket) {
    this.send(client, {
      event: MessageEvent.HEALTH_CHECK,
      payload: {
        message: "The backend is online (atleast for now)",
      },
    });
  }

  /**
   * Handles the connect request from a client.
   * Sends the playerId and gameId to the client.
   * If a playerId is received and it matches an existing player, the same playerId is sent, otherwise a new playerId is created.
   * The gameId is sent if the player was a part of an existing game.
   */
  private async handleConnect(client: WebSocket, payload: any) {
    const { playerId } = payload;

    if (!playerId) {
      this.handleNewPlayerConnect(client);
      return;
    }

    // validate the playerId.
    const validPlayerId = await this.gameService.validatePlayerId(playerId);
    if (!validPlayerId) {
      // the player had an invalid playerId, nothing different than a new player.
      this.handleNewPlayerConnect(client);
      return;
    }

    // save the playerId in the local map.
    this.clientPlayerIds.set(client, playerId);

    // fetch the gameId of the game that the player was a part of.
    const gameId = await this.gameService.getGameId(playerId);

    if (!gameId) {
      // the player wasn't a part of any game
      this.send(client, {
        event: MessageEvent.CONNECT,
        payload: {
          playerId: playerId,
          existingGameId: null,
        },
      });
    } else {
      // the player was part of an ongoing game, offer to connect

      this.send(client, {
        event: MessageEvent.CONNECT,
        payload: {
          playerId: playerId,
          existingGameId: gameId,
        },
      });
    }
  }

  /** Creates a new playerId and sends it to the client. */
  private async handleNewPlayerConnect(client: WebSocket) {
    const newPlayerId = uuid();
    this.clientPlayerIds.set(client, newPlayerId);

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: newPlayerId,
        existingGameId: null,
      },
    });
  }

  private async handleRejoinGame(client: WebSocket) {
    const playerId = this.clientPlayerIds.get(client);

    if (!playerId) {
      this.logger.warn("Trying to retrieve the playerId of an unknown client");
      return;
    }

    const gameInfo = await this.gameService.getGameInfo(playerId);

    if (gameInfo.gameStatus === GameStatus.WAITING) {
      // save the gameId in the local map
      this.clientGameIds.set(client, gameInfo.gameId as string);

      // add the player to the game object
      await this.gameService.rejoinPlayer(playerId, gameInfo.gameId as string);

      this.send(client, {
        event: MessageEvent.REJOIN_GAME,
        payload: {
          gameId: gameInfo.gameId,
        },
      });

      // resub the client
      await this.subscribeToGame(client);

      // notify others that this player has rejoined
      const newPlayerInfo = (await this.gameService.getPlayerInfo(
        playerId,
      )) as NewPlayerInfo; // the player validity is already checked while retrieving the gameInfo

      await this.pubClient.publish(
        `game:${gameInfo.gameId}`,
        JSON.stringify({
          event: BroadcastEvent.NEW_PLAYER_JOINED,
          payload: {
            newPlayerInfo,
          },
        }),
      );
    } else {
      this.send(client, {
        event: MessageEvent.DISCONNECT,
        payload: {},
      });
    }

    // fetch the game status of the game, if its still waiting, rejoin, add user to the game and broadcast, update the local maps.
    // otherwise return an error message
    // fetch the game status only.
  }

  /** Verifies if a client has an associated gameId and playerId. Returns true if valid*/
  private verifySocket(client: WebSocket): boolean {
    const playerId = this.clientPlayerIds.get(client);
    const gameId = this.clientGameIds.get(client);

    if (!playerId) {
      this.sendError(client, "Player verification failed. Please reconnect.");
      LoggingService.getInstance().warn("Invalid player caught");

      return false;
    }

    if (!gameId) {
      this.sendError(
        client,
        "Player is not associated with any game. Please reconnect.",
      );
      LoggingService.getInstance().warn("Orphan player caught");

      return false;
    }

    return true;
  }

  /** Sends the message to all clients subscribed to the game */
  private async broadcastToGame(gameId: string, message: string) {
    const clients: WebSocket[] =
      this.clientSubscriptions.get(`game:${gameId}`) || [];

    if (clients.length === 0) {
      // there are no listeners
      LoggingService.getInstance().warn("Broadcasting to an empty channel");
      return;
    } else {
      for (const client of clients) {
        client.send(message);
      }
    }
  }

  /** Unsubscribes a client from the game. The instance unsubscribs from the channel if there are no clients listening to it */
  private async unsubscribeFromGame(client: WebSocket) {
    // validate the socket
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = this.clientPlayerIds.get(client);
    const gameId = this.clientGameIds.get(client);

    // remove the client from the game
    const clients: WebSocket[] =
      this.clientSubscriptions.get(`game:${gameId}`) || [];
    const updatedClients = clients.filter(
      (client) => this.clientPlayerIds.get(client) !== playerId,
    );
    this.clientSubscriptions.set(`game:${gameId}`, updatedClients);

    if (updatedClients.length === 0) {
      // there are no clients listening for this channel, unsubscribe
      await this.subClient.unsubscribe(`game:${gameId}`);
    }
  }

  /** Subscribes a client to game updates via the pub-sub manager */
  private async subscribeToGame(client: WebSocket) {
    // validate the socket
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string; // because the socket always has a known gameId attached to it, the gameId is known to exist and we can skip the validation.
    const playerId = this.clientPlayerIds.get(client) as string;

    const clients = this.clientSubscriptions.get(`game:${gameId}`) || [];
    if (clients.length === 0) {
      // new connection, subscribe the instance to the channel
      await this.subClient.subscribe(`game:${gameId}`, (message: string) =>
        this.broadcastToGame(gameId, message),
      );
    }
    const clientExists = clients.some(
      (existingClient) => this.clientPlayerIds.get(existingClient) === playerId,
    );
    if (!clientExists) {
      // if this client does not exist already, add and update
      clients.push(client);

      this.clientSubscriptions.set(`game:${gameId}`, clients);
    }
  }

  /** Creates a new game and sets up the listener for any changes */
  private async handleCreateGame(client: WebSocket) {
    const playerId = this.clientPlayerIds.get(client);
    if (!playerId) {
      this.sendError(
        client,
        "Failed to create a new game. Player ID is missing.",
      );
      LoggingService.getInstance().warn(
        "Failed to create a new game -> invalid player",
      );

      return;
    }

    const gameId = this.clientGameIds.get(client);
    if (gameId) {
      this.sendError(
        client,
        "You are already in a game. Leave the current game to create a new one.",
      );
      LoggingService.getInstance().warn(
        "Failed to create a new game -> player was already part of a game",
      );
      return;
    }

    const newGameId = await this.gameService.createGame(playerId);
    // attach the gameId to the socket.
    this.clientGameIds.set(client, newGameId);

    this.send(client, {
      event: MessageEvent.CREATE_GAME,
      payload: {
        gameId: newGameId,
      },
    });

    // subscribe the client to the is new game.
    await this.subscribeToGame(client);
  }

  /** Joins the client to a game room if the max size has not been exceeded and notifies to the other clients */
  private async handleJoinGame(client: WebSocket, payload: any) {
    const playerId = this.clientPlayerIds.get(client);
    if (!playerId) {
      LoggingService.getInstance().warn(
        "Failed to join a game -> invalid player",
      );
      this.sendError(client, "Failed to join the game. Player ID is missing.");
      return;
    }

    const existingGameId = this.clientGameIds.get(client);
    if (existingGameId) {
      this.sendError(
        client,
        "You are already in a game. Leave the current game to join a new one.",
      );
      LoggingService.getInstance().warn(
        "Failed to join a game -> player was already part of a game",
      );
      return;
    }

    const { gameId } = payload;

    if (!gameId) {
      this.sendError(
        client,
        "You're almost there! Enter an invite code to join",
      );
      return;
    }
    // validate this newGameId
    const validGame = await this.gameService.validateGameId(gameId);
    if (!validGame) {
      this.sendError(client, "The invite code doesn't look good. Try again?");
      return;
    }

    // ensure that the room size does not exceed the MAX_SIZE
    const currentSize = (await this.gameService.getRoomSize(gameId)) as number;
    if (currentSize > MAX_SIZE) {
      this.sendError(client, "This game is already full");
      return;
    }

    await this.gameService.addPlayer(playerId, gameId);
    // add the gameId to the socket.
    this.clientGameIds.set(client, gameId);
    this.send(client, {
      event: MessageEvent.JOIN_GAME,
      payload: {
        gameId,
      },
    });
    // publish this new player on the game channel
    const newPlayerInfo = (await this.gameService.getPlayerInfo(
      playerId,
    )) as NewPlayerInfo;
    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.NEW_PLAYER_JOINED,
        payload: {
          newPlayerInfo,
        },
      }),
    );

    // subscribe this client to the game.
    await this.subscribeToGame(client);
  }

  /** Verifies the incoming gameId and subscribes the client to the game(if valid). Returns false if no gameId was received */
  private async handleCheckGameId(client: WebSocket, payload: any) {
    // validate the socket.
    if (!this.verifySocket(client)) {
      return;
    }

    const { gameId } = payload;

    const validGame = await this.gameService.validateGameId(gameId);

    this.send(client, {
      event: MessageEvent.CHECK_GAME_ID,
      payload: {
        isGameInvalid: !validGame,
      },
    });
  }

  /** Returns the current game lobby of the given game */
  private async handleGetLobby(client: WebSocket) {
    // validate the client.
    if (!this.verifySocket(client)) return;

    const gameId = this.clientGameIds.get(client) as string;
    const lobby = await this.gameService.getLobby(gameId);
    if (lobby) {
      this.send(client, {
        event: MessageEvent.GET_LOBBY,
        payload: {
          lobby,
        },
      });
    }
  }

  /** Changes the player username and notifies other clients */
  private async handleChangeUsername(client: WebSocket, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = this.clientPlayerIds.get(client) as string;
    const gameId = this.clientGameIds.get(client) as string;

    const { newUsername } = payload;

    if (!newUsername) {
      this.sendError(client, "Please provide a username");

      return;
    }

    const userNameChanged = await this.gameService.changeUsername(
      playerId,
      newUsername,
    );

    if (userNameChanged) {
      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.USERNAME_CHANGED,
          payload: {
            updatedPlayer: {
              playerId,
              playerName: newUsername,
            },
          },
        }),
      );
    } else {
      this.logger.warn("The username was not updated");
      this.sendError(
        client,
        "Something went wrong, couldn't update the username",
      );
    }
  }

  /** Updates the game status to STARTING and broadcasts the countdown. Updates the game to IN_PROGRESS after the countdown. */
  private async handleStartGame(client: WebSocket): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string;
    const playerId = this.clientPlayerIds.get(client) as string;

    // check if the game has the minimum number of players
    const size = (await this.gameService.getRoomSize(gameId)) as number; // the gameId taken from the socket will always be authentic.

    if (size < MIN_SIZE) {
      this.sendError(
        client,
        "You need more players to start the game. Gather some friends!",
      );
      return;
    }

    // fetch the hostId of the game.
    const hostId = await this.gameService.getHostId(gameId);

    if (playerId !== hostId) {
      this.sendError(client, "Only the host of the game can start the game");
      return;
    }

    // change the status of the game to starting.
    const success = await this.gameService.updateGameStatus(
      gameId,
      GameStatus.STARTING,
    );

    if (!success) {
      LoggingService.getInstance().error(
        "The game status could not be updated to STARTING",
      );
      this.sendError(client, "Failed to start the game. Please try again.");
      return;
    }

    // broadcast to other players.
    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.GAME_STARTING,
        payload: {},
      }),
    );

    // start the countdown.
    let count = 10;

    const countdownInterval = setInterval(async () => {
      // Send current count
      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.GAME_STARTING_COUNTDOWN,
          payload: {
            count,
          },
        }),
      );

      // Decrement count
      count--;

      // Check if countdown is complete
      if (count < 0) {
        clearInterval(countdownInterval);

        const success = await this.gameService.updateGameStatus(
          gameId,
          GameStatus.IN_PROGRESS,
        );

        if (!success) {
          LoggingService.getInstance().error(
            "Couldn't update the game status to IN_PROGRESS",
          );
          this.sendError(client, "Failed to start the game. Please try again.");
          return;
        }

        // start the game
        await this.pubClient.publish(
          `game:${gameId}`,
          JSON.stringify({
            event: BroadcastEvent.GAME_STARTED,
            payload: {
              message: "Game started!",
            },
          }),
        );
      }
    }, 1000);
  }

  /** Sends the game text for the given game */
  private async handleGetGameText(client: WebSocket) {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string;

    const gameText = await this.gameService.getGameText(gameId);

    if (gameText) {
      this.send(client, {
        event: MessageEvent.GET_GAME_TEXT,
        payload: {
          gameText,
        },
      });
    } else {
      LoggingService.getInstance().warn("Game text is null");
    }
  }

  /** Sends the game players with their initial position */
  private async handleGetGamePlayers(client: WebSocket) {
    if (!this.verifySocket) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string;

    const players = await this.gameService.getGamePlayers(gameId);

    if (players) {
      this.send(client, {
        event: MessageEvent.GET_GAME_PLAYERS,
        payload: {
          players,
        },
      });
    }
  }

  /** Broadcasts player position updates */
  private async handlePlayerUpdate(client: WebSocket, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = this.clientPlayerIds.get(client);
    const gameId = this.clientGameIds.get(client);

    // verify that the payload has the required fields
    if (!payload.position && isNaN(Number(payload.position))) {
      return;
    }

    // broadcast the position to others
    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.PLAYER_UPDATE,
        payload: {
          playerId,
          position: payload.position,
        },
      }),
    );
  }

  /** Updates the game result by adding the incoming client. If all the players are finished, updates the game status */
  private async handleFinishGame(client: WebSocket, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = this.clientPlayerIds.get(client) as string;
    const gameId = this.clientGameIds.get(client) as string;

    // sanitize the payload
    const wpm = Number(payload.wpm);
    const accuracy = Number(payload.accuracy);
    const time = Number(payload.time);

    if (Number.isNaN(wpm) || Number.isNaN(accuracy) || Number.isNaN(time)) {
      LoggingService.getInstance().error(
        `Invalid request for finishing the game. Received wpm: ${wpm}, accuracy: ${accuracy}, time: ${time}`,
      );

      this.sendError(
        client,
        "Failed to finish the game. Invalid performance metrics provided.",
      );

      return;
    }

    const playerData = {
      wpm,
      accuracy,
      time,
    };

    // save the game data
    await this.gameService.finishGame(playerId, playerData, gameId);

    const allPlayersFinished =
      await this.gameService.checkAllPlayersFinished(gameId);

    if (allPlayersFinished) {
      await this.gameService.markGameFinished(gameId);

      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.FINISH_GAME,
          payload: {},
        }),
      );
    }
  }

  /** Sends the gameResult to the client */
  private async handleGetGameResult(client: WebSocket) {
    // ensure that this connection is valid
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string;

    // fetch the game result
    const gameResult = await this.gameService.getGameResult(gameId);

    if (gameResult) {
      this.send(client, {
        event: MessageEvent.GET_GAME_RESULT,
        payload: {
          hostId: gameResult.hostId,
          players: gameResult.players,
        },
      });
    }
  }

  private async handleRestartGame(client: WebSocket) {
    // verify this client
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = this.clientGameIds.get(client) as string;
    const playerId = this.clientPlayerIds.get(client) as string;

    // ensure that the client is the host of the game, as only the host should be able to restart the game
    const hostId = await this.gameService.getHostId(gameId);

    if (hostId !== playerId) {
      this.sendError(client, "Only the host of the game can restart the game");
      return;
    }

    // create a new game with the same players and return the new id
    const newGameId = await this.gameService.restartGame(gameId);

    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.GAME_RESTARTING,
        payload: {
          newGameId,
        },
      }),
    );

    // subscribe everyone of this game to the new one and update the map
    const clients = this.clientSubscriptions.get(`game:${gameId}`);

    if (clients) {
      await this.subClient.subscribe(`game:${newGameId}`, (message: string) =>
        this.broadcastToGame(newGameId, message),
      );

      const newClients = [...clients];
      this.clientSubscriptions.set(`game:${newGameId}`, newClients);

      for (const clientSocket of clients) {
        this.clientGameIds.set(clientSocket, newGameId);
      }

      this.clientSubscriptions.delete(`game:${gameId}`);
    }
  }

  private async handleCancelRejoin(client: WebSocket) {
    const playerId = this.clientPlayerIds.get(client);

    if (!playerId) {
      this.logger.warn("Cancelling the rejoin of an unknown player");
      return;
    }

    // nullify the playerId of the client.
    await this.gameService.resetPlayerCurrentGameId(playerId);

    this.send(client, {
      event: MessageEvent.CANCEL_REJOIN,
      payload: {},
    });
  }

  private async handleLeaveGame(client: WebSocket) {
    //verify the socket.
    if (!this.verifySocket(client)) {
      return;
    }

    // remove this player from the game and update the socket
    const playerId = this.clientPlayerIds.get(client) as string;
    const gameId = this.clientGameIds.get(client) as string;

    let updatedHostId = null;

    updatedHostId = await this.gameService.removePlayerFromGame(
      playerId,
      gameId,
    );

    // nullify the current game id of the player
    await this.gameService.resetPlayerCurrentGameId(playerId);

    // notify the client that it can leave now
    this.send(client, {
      event: MessageEvent.LEAVE_GAME,
      payload: {},
    });

    // unsubscribe the client from the game
    await this.unsubscribeFromGame(client);

    // delete the game association for this client.
    this.clientGameIds.delete(client);

    // update others if there is a new host, if there was no host, the game has no players, no point in broadcasting it
    if (updatedHostId) {
      const message = JSON.stringify({
        event: BroadcastEvent.PLAYER_LEFT,
        payload: {
          playerId,
          updatedHostId,
        },
      });
      await this.pubClient.publish(`game:${gameId}`, message);
    }
  }
}
