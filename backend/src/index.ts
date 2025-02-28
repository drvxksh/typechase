import express from "express";
import http from "http";
import { WebSocketService } from "./services/websocketService";
import { GameController } from "./services/gameService";

const app = express();
const PORT = 3000;

app.use(express.json());

const server = http.createServer(app);

// bind the websocket to the httpServer
const webSocketInstance = WebSocketService.getInstance(server);
const gameController = new GameController(webSocketInstance);

server.listen(PORT, () => {
  console.log(`The server is running at http://localhost:${PORT}`);
});
