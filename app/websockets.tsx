import { createContext, useContext, type ReactNode } from "react";

type ProviderProps = {
  ws: WebSocket | null;
  children: ReactNode;
};

const context = createContext<WebSocket | null>(null);

export function useWs() {
  return useContext(context);
}

export function WsProvider({ ws, children }: ProviderProps) {
  return <context.Provider value={ws}>{children}</context.Provider>;
}
