import compression from "compression";
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

let userCount = 0;
wss.on("connection", (ws) => {
  ws.on("error", console.error);

  ws.on("message", (data, isBinary) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN)
        client.send(data, { binary: isBinary });
    });
  });
  console.log("user connected", ++userCount);
  ws.send("Hello from the server!");
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
