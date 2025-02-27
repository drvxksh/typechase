import express from "express";
import http from "http";
import { WebSocketController } from "./services/websocketService";

const app = express();
const PORT = 3000;

app.use(express.json());

const server = http.createServer(app);

// bind the websocket to the httpServer
WebSocketController.getInstance(server);

server.listen(PORT, () => {
  console.log(`The server is running at http://localhost:${PORT}`);
});
