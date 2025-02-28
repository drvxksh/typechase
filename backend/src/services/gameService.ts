import {
  Game,
  GameStatus,
  MessageType,
  Player,
  SubscriptionType,
} from "../types";
import { PubSubManager } from "./pubSubManager";
import { RedisService } from "./redisService";
import { v4 as uuid } from "uuid";
import { WebSocketService } from "./websocketService";

export class GameController {
  private redisService: RedisService;
  private pubSubManager: PubSubManager;
  private webSocketService: WebSocketService;

  constructor(wss: WebSocketService) {
    this.redisService = RedisService.getInstance();
    this.pubSubManager = PubSubManager.getInstance();
    this.webSocketService = wss;
  }
  public async createGameRoom(host: Player) {
    const gameId = uuid();

    // structure the game data and save into redis
    const gameData: Game = {
      id: gameId,
      hostUserId: host.id,
      players: [host],
      text: "",
      createdAt: Date.now(),
      status: GameStatus.WAITING,
    };

    await this.redisService.hSet(gameId, gameData);

    await this.pubSubManager.subscribe(
      `${SubscriptionType.ROOM_SIZE}:${gameId}`,
      async (message: string) => {
        try {
          const roomSize = parseInt(message, 10);
          if (isNaN(roomSize)) {
            throw new Error("Message is not a number");
          }
          this.webSocketService.send(host.id, {
            type: MessageType.ROOM_SIZE,
            payload: {
              message: "The players in the room have changed",
              size: roomSize,
            },
          });
        } catch (err) {
          console.error(err);

          const roomData = await this.redisService.hGet(gameId);
          const roomSize = roomData.players.length;

          this.webSocketService.send(host.id, {
            type: MessageType.ROOM_SIZE,
            payload: {
              message: "The players in the room have changed",
              size: roomSize,
            },
          });
        }
      }
    );

    return gameId;
  }
}
