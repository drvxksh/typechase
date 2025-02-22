import "react-router";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import eventEmitter from "../server.emitter.js";

type RoomInfoType = {
  status: "lobby" | "playing" | "ended";
  admin: WebSocket;
  joinedClients: WebSocket[];
  createdAt: Date;
};

declare module "react-router" {
  interface AppLoadContext {
    rooms: Record<string, RoomInfoType>;
  }
}

export const app = express();

const rooms: Record<string, RoomInfoType> = {};

app.use(
  createRequestHandler({
    // @ts-expect-error - virtual module provided by React Router at build time
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      return {
        rooms,
      };
    },
  })
);
