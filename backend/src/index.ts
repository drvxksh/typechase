import express from "express";
import http from "http";
import { CommunicationService } from "./services/communicationService";

const PORT = 3000;

const app = express();
const server = http.createServer(app);

// Attaches the server to the communication service.
CommunicationService.initialize(server);

app.get("/", (req, res) => {
  res.send("The server is online!");
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
