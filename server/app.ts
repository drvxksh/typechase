import "react-router";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import eventEmitter from "../server.emitter.js";

declare module "react-router" {
  interface AppLoadContext {
    VALUE_FROM_EXPRESS: string;
  }
}

export const app = express();

const rooms = new Map();
const userSockets = new Map();

app.use(
  createRequestHandler({
    // @ts-expect-error - virtual module provided by React Router at build time
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      return {
        VALUE_FROM_EXPRESS: "Hello from Express",
      };
    },
  })
);
