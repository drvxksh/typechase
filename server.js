import compression from "compression";
import { randomUUID } from "crypto";
import express from "express";
import { createServer } from "http";
import morgan from "morgan";
import WebSocket, { WebSocketServer } from "ws";

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

const app = express();

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

let rooms = {};
let users = {};
const maxClients = 5;

wss.on("connection", (ws) => {
  ws.on("error", console.error);

  if (!ws["userId"]) {
    ws["userId"] = randomUUID();
    ws.send(JSON.stringify({ userId: ws["userId"] }));
  }

  ws.on("message", (data) => {
    const obj = JSON.parse(data);
    const query = obj.query;
    const params = obj.params;

    switch (query) {
      case "create":
        create();
        break;
      case "join":
        join(params);
        break;
      case "leave":
        leave();
        break;
      default:
        console.warn(`Query ${query} unknown`);
        break;
    }
  });

  function create() {
    if (ws["roomId"]) {
      console.warn("Duplicate room creation");
      ws.send(JSON.stringify({ success: true, roomId }));
    }

    const roomId = randomUUID();

    rooms[roomId] = [ws];
    users[ws["userId"]] = roomId;

    ws["roomId"] = roomId;

    ws.send(JSON.stringify({ success: true, roomId }));
  }

  function join(params) {
    const roomId = params.roomId;
    if (!Object.keys(rooms).includes(roomId)) {
      console.warn(`Room ${roomId} does not exist`);
      return;
    }

    if (rooms[roomId].length >= maxClients) {
      console.warn(`Room ${roomId} is full`);
      return;
    }

    rooms[roomId].push(ws);
    users[ws["userId"]] = roomId;

    ws["roomId"] = roomId;

    ws.send(JSON.stringify({ success: true, size: rooms[roomId].length }));
  }

  function leave() {
    const roomId = ws.roomId;
    rooms[roomId] = rooms[roomId].filter((entry) => entry != ws);
    delete users[ws.userId];
    ws.roomId = null;
    ws.userId = null;

    if (rooms[roomId].length === 0) {
      rooms = rooms.filter((key) => key != roomId);
    }

    ws.send(JSON.stringify({ success: true }));
  }
});

app.use(compression());
app.disable("x-powered-by");

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    })
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  console.log("Starting production server");
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" })
  );
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(await import(BUILD_PATH).then((mod) => mod.app));
}

app.use(morgan("tiny"));

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
