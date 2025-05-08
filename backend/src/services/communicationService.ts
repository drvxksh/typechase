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
  SocketClient,
  WebSocketMessage,
} from "../types";
import { GameService } from "./gameService";
import { LoggingService } from "./loggingService";

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
  private clientSubscriptions: Map<string, SocketClient[]>; // used to track the channel and its clients for this instance
  private logger = LoggingService.getInstance();

  private constructor(server: http.Server) {
    // instantiate all the services
    this.pubClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });
    this.subClient = this.pubClient.duplicate();
    this.gameService = new GameService();
    this.wss = new WebSocket.Server({ server });
    this.clientSubscriptions = new Map();

    Promise.all([this.pubClient.connect(), this.subClient.connect()])
      .then(() => {
        this.logger.info("Pub-Sub clients connected");
      })
      .catch((err) =>
        this.logger.error(`Pub-Sub client connection error: ${err}`),
      );

    this.wss.on("connection", (ws: WebSocket) => {
      const socketClient = ws as SocketClient;

      ws.on("error", (err) => {
        this.logger.error(`Websocket error: ${err}`);
        this.sendError(
          socketClient,
          "Server closed the connection unexpectedly",
        );
      });

      ws.on("close", async () => {
        const playerId = socketClient.playerId;
        const gameId = socketClient.gameId;

        let updatedHostId = null;

        // unsubscribe the client from the game
        await this.unsubscribeFromGame(socketClient);

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
            socketClient,
            "Invalid message format received. Please check your request.",
          );
        }

        if (data) {
          await this.processMessage(socketClient, data);
        }
      });
    });
  }

  /** Sends an error message to the client via websockets */
  private sendError(client: SocketClient, errorMessage: string): void {
    this.send(client, {
      event: MessageEvent.ERROR,
      payload: { message: errorMessage },
    });
  }

  /** Sends the message to the client via websockets if the connection is open */
  private send(client: SocketClient, message: WebSocketMessage) {
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
    client: SocketClient,
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
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
        break;
    }
  }

  /** Handles the health check request from a client. Sends a message to confirm that the connection is alive */
  private async handleHealthCheck(client: SocketClient) {
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
  private async handleConnect(client: SocketClient, payload: any) {
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

    // fetch the gameId and state of the Game
    const gameInfo = await this.gameService.getGameInfo(playerId);

    if (!gameInfo.gameId) {
      // the player wasn't a part of any game
      client.playerId = playerId;

      this.send(client, {
        event: MessageEvent.CONNECT,
        payload: {
          playerId: client.playerId,
          existingGameId: null,
        },
      });
    } else {
      switch (gameInfo.gameStatus) {
        case GameStatus.WAITING: {
          // update the socket
          client.playerId = playerId;
          client.gameId = gameInfo.gameId;

          // add the player back to the game
          await this.gameService.rejoinPlayer(playerId, gameInfo.gameId);

          // resub the client
          await this.subscribeToGame(client);

          // notify others that this player has joined again
          const newPlayerInfo = (await this.gameService.getPlayerInfo(
            playerId,
          )) as NewPlayerInfo; // if you're here, the player validity has already been checked so we can fetch without checking

          await this.pubClient.publish(
            `game:${gameInfo.gameId}`,
            JSON.stringify({
              event: BroadcastEvent.NEW_PLAYER_JOINED,
              payload: {
                newPlayerInfo,
              },
            }),
          );

          // return the connect request.
          this.send(client, {
            event: MessageEvent.CONNECT,
            payload: {
              playerId: client.playerId,
              existingGameId: gameInfo.gameId,
            },
          });
        }
        default: {
          // disconnected in the middle of the game, back to the landing page
          client.gameId = undefined;

          this.send(client, {
            event: MessageEvent.DISCONNECT,
            payload: {},
          });
        }
      }
    }
  }

  /** Creates a new playerId and sends it to the client. */
  private async handleNewPlayerConnect(client: SocketClient) {
    const newPlayerId = uuid();
    client.playerId = newPlayerId;

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: newPlayerId,
        existingGameId: null,
      },
    });
  }

  /** Verifies if a client has an associated gameId and playerId. Returns true if valid*/
  private verifySocket(client: SocketClient): boolean {
    if (!client.playerId) {
      this.sendError(client, "Player verification failed. Please reconnect.");
      LoggingService.getInstance().warn("Invalid player caught");

      return false;
    }

    if (!client.gameId) {
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
    const clients: SocketClient[] =
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
  private async unsubscribeFromGame(client: SocketClient) {
    // validate the socket
    if (!this.verifySocket(client)) {
      return;
    }

    // reset the gameId of the client
    const gameId = client.gameId;
    client.gameId = undefined;

    // rmeove the client from the game
    const clients: SocketClient[] =
      this.clientSubscriptions.get(`game:${gameId}`) || [];
    const updatedClients = clients.filter(
      (otherClients) => otherClients.playerId !== client.playerId,
    );
    this.clientSubscriptions.set(`game:${gameId}`, updatedClients);

    if (updatedClients.length === 0) {
      // there are no clients listening for this channel, unsubscribe
      await this.subClient.unsubscribe(`game:${gameId}`);
    }
  }

  /** Subscribes a client to game updates via the pub-sub manager */
  private async subscribeToGame(client: SocketClient) {
    // validate the socket
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string; // because the socket always has a known gameId attached to it, the gameId is known to exist and we can skip the validation.

    const clients = this.clientSubscriptions.get(`game:${gameId}`) || [];
    if (clients.length === 0) {
      // new connection, subscribe the instance to the channel
      await this.subClient.subscribe(`game:${gameId}`, (message: string) =>
        this.broadcastToGame(gameId, message),
      );
    }
    const clientExists = clients.some(
      (existingClient) => existingClient.playerId === client.playerId,
    );
    if (!clientExists) {
      // if this client does not exist already, add and update
      clients.push(client);

      this.clientSubscriptions.set(`game:${gameId}`, clients);
    }
  }

  /** Creates a new game and sets up the listener for any changes */
  private async handleCreateGame(client: SocketClient) {
    const playerId = client.playerId;
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

    const gameId = client.gameId;
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
    this.send(client, {
      event: MessageEvent.CREATE_GAME,
      payload: {
        gameId: newGameId,
      },
    });
  }

  /** Joins the client to a game room if the max size has not been exceeded and notifies to the other clients */
  private async handleJoinGame(client: SocketClient, payload: any) {
    const playerId = client.playerId;
    if (!playerId) {
      LoggingService.getInstance().warn(
        "Failed to join a game -> invalid player",
      );
      this.sendError(client, "Failed to join the game. Player ID is missing.");
      return;
    }

    const existingGameId = client.gameId;
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
  }

  /** Verifies the incoming gameId and subscribes the client to the game(if valid). Returns false if no gameId was received */
  private async handleCheckGameId(client: SocketClient, payload: any) {
    // validate the socket.
    if (!this.verifySocket(client)) {
      return;
    }

    const { gameId } = payload;

    const validGame = await this.gameService.validateGameId(gameId);
    if (validGame) {
      // attach the socket client to this gameId
      client.gameId = gameId;
      // subscribe the client to the gameId
      await this.subscribeToGame(client);
    }
    this.send(client, {
      event: MessageEvent.CHECK_GAME_ID,
      payload: {
        isGameInvalid: !validGame,
      },
    });
  }

  /** Returns the current game lobby of the given game */
  private async handleGetLobby(client: SocketClient) {
    // validate the client.
    if (!this.verifySocket(client)) return;

    const gameId = client.gameId as string;
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
  private async handleChangeUsername(client: SocketClient, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId as string;
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
        `game:${client.gameId}`,
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
  private async handleStartGame(client: SocketClient): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

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

    if (client.playerId !== hostId) {
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
  private async handleGetGameText(client: SocketClient) {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

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
  private async handleGetGamePlayers(client: SocketClient) {
    if (!this.verifySocket) {
      return;
    }

    const gameId = client.gameId as string;

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
  private async handlePlayerUpdate(client: SocketClient, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId;
    const gameId = client.gameId;

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
  private async handleFinishGame(client: SocketClient, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId as string;
    const gameId = client.gameId as string;

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
  private async handleGetGameResult(client: SocketClient) {
    // ensure that this connection is valid
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    // fetch the game result
    const players = await this.gameService.getGameResult(gameId);

    if (players) {
      this.send(client, {
        event: MessageEvent.GET_GAME_RESULT,
        payload: {
          players,
        },
      });
    }
  }

  private async handleRestartGame(client: SocketClient) {
    // verify this client
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    // ensure that the client is the host of the game, as only the host should be able to restart the game
    const hostId = await this.gameService.getHostId(gameId);

    if (hostId !== client.playerId) {
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

    // unsubscribe this instance from the game, as there would be nobody listening to it now
    await this.subClient.unsubscribe(`game:${gameId}`);

    // clear the client mapping for this game channel
    this.clientSubscriptions.delete(`game:${gameId}`);
  }

  private async handleLeaveGame(client: SocketClient) {
    //verify the socket.
    if (!this.verifySocket(client)) {
      return;
    }

    // remove this player from the game and update the socket
    const playerId = client.playerId as string;
    const gameId = client.gameId as string;

    let updatedHostId = null;

    updatedHostId = await this.gameService.removePlayerFromGame(
      playerId,
      gameId,
    );

    // notify the client that it can leave now
    this.send(client, {
      event: MessageEvent.LEAVE_GAME,
      payload: {},
    });

    // unsubscribe the client from the game
    await this.unsubscribeFromGame(client);

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
