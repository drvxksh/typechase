import { ReactNode } from "react";
import { WebSocketContext } from "../hooks/useWebSocket";
import { ConnectionStatus } from "../types";

type ProviderProps = {
  websocket: WebSocket | null;
  connectionStatus: ConnectionStatus;
  children: ReactNode;
};

export function WebSocketProvider({
  websocket,
  connectionStatus,
  children,
}: ProviderProps) {
  return (
    <WebSocketContext.Provider value={[websocket, connectionStatus]}>
      {children}
    </WebSocketContext.Provider>
  );
}
