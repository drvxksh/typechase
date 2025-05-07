import express from "express";
import http from "http";
import { CommunicationService } from "./services/communicationService";
import { LoggingService } from "./services/loggingService";

const logger = LoggingService.getInstance();
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

CommunicationService.initialize(server);

app.get("/", (req, res) => {
  res.send("The server is online!");
});

server.listen(PORT, () => {
  logger.info(`Server is running at http://localhost:${PORT}`);
});
