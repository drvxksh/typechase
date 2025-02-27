import express from "express";
import http from "http";

const app = express();
const PORT = 3000;

app.use(express.json());

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`The server is running at http://localhost:${PORT}`);
});
