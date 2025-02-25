import type { Server } from "http";
import WebSocket from "ws";
import { MessageType, SocketClient, WebSocketMessage } from "../types";
import { v4 as uuid } from "uuid";
import { getPlayer, savePlayer } from "../services/RedisService";

/** Stores all the active websocket connections */
const clients: Map<string, Set<WebSocket>> = new Map();

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", async (ws: WebSocket) => {
    const socketClient = ws as SocketClient;
    socketClient.isAlive = true;
    socketClient.lastActivity = Date.now();

    socketClient.on("message", async (message: string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message);
        socketClient.lastActivity = Date.now();

        await processMessage(socketClient, data);
      } catch (err) {
        console.error("Error processing message", err);
        sendError(socketClient, "Invalid Message format");
      }
    });

    socketClient.on("close", () => {
      handleDisconnect(socketClient);
    });

    socketClient.on("pong", () => {
      socketClient.isAlive = true;
    });
  });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as SocketClient;

      if (client.isAlive === false) {
        handleDisconnect(client);
        return client.terminate();
      }

      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  return wss;
}

async function processMessage(
  client: SocketClient,
  message: WebSocketMessage
): Promise<void> {
  const { type, payload } = message;

  switch (type) {
    case MessageType.CONNECT:
      await handleConnect(client, payload);
      break;

    case MessageType.RECONNECT:
      await handleReconnect(client, payload);
      break;

    case MessageType.JOIN_GAME:
      await handleGameJoin(client, payload);
      break;

    case MessageType.CREATE_GAME:
      await handleGameCreate(client, payload);
      break;

    case MessageType.TYPING_PROGRESS:
      await handleTypingProgress(client, payload);
      break;

    default:
      sendError(client, `Unsupported message type: ${type}`);
  }
}

async function handleConnect(
  client: SocketClient,
  payload: any
): Promise<void> {
  const { playerId, playerName } = payload;

  if (playerId) {
    await handleReconnect(client, payload);
  } else {
    const newPlayerId = uuid();
    client.id = newPlayerId;

    await handlePlayerConnect(
      client,
      playerName || `Player_${newPlayerId.substring(0, 6)}`
    );

    addClientConnection(newPlayerId, client);

    send(client, {
      type: MessageType.CONNECT,
      payload: {
        playerId: newPlayerId,
        message: "Connected successfully :)",
      },
    });
  }
}

async function handleReconnect(
  client: SocketClient,
  payload: any
): Promise<void> {
  const { playerId, playerName } = payload;

  const existingPlayer = await getPlayer(playerId);

  if (existingPlayer) {
    client.id = playerId;

    existingPlayer.connected = true;
    existingPlayer.lastSeen = Date.now();

    if (playerName) {
      existingPlayer.name = playerName;
    }

    await savePlayer(existingPlayer);

    addClientConnection(playerId, client);

    send(client, {
      type: MessageType.RECONNECT,
      payload: {
        playerId,
        gameId: existingPlayer.id,
        messgae: "Reconnected successfully :)",
      },
    });
  } else {
    await handleConnect(client, { playerName });
  }
}

function handleDisconnect(client: SocketClient): void {
  if (!client.id) return;

  console.log(`Client disconnected: ${client.id}`);

  const connections = clients.get(client.id);
  if (connections) {
    connections.delete(client);
    if (connections.size === 0) {
      clients.delete(client.id);
    }
  }

  // Player status will be updated by the heartbeat mechanism
  //don't immediately remove the player to allow for reconnections
}

function addClientConnection(playerId: string, client: SocketClient): void {
  if (!clients.has(playerId)) {
    clients.set(playerId, new Set());
  }
  clients.get(playerId)?.add(client);
}

export function send(client: SocketClient, message: WebSocketMessage): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

export function sendError(client: SocketClient, errorMessage: string): void {
  send(client, {
    type: MessageType.ERROR,
    payload: {
      message: errorMessage,
    },
  });
}

export function broadcastToPlayer(
  playerId: string,
  message: WebSocketMessage
): void {
  const connections = clients.get(playerId);
  if (!connections) return;

  connections.forEach((connection) => {
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(message));
    }
  });
}

export function broadcastToGame(
  gameId: string,
  message: WebSocketMessage,
  excludePlayerId?: string
): void {
  clients.forEach((connections, playerId) => {
    if (excludePlayerId && playerId === excludePlayerId) return;

    connections.forEach((connection) => {
      const client = connection as SocketClient;
      if (client.gameId === gameId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  });
}

export function getPlayerConnections(
  playerId: string
): Set<WebSocket> | undefined {
  return clients.get(playerId);
}

export function isPlayerConnected(playerId: string): boolean {
  const connections = clients.get(playerId);
  return !!connections && connections.size > 0;
}
