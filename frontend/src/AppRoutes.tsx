import { Route, Routes } from "react-router";
import Landing from "./Pages/Landing";
import { Toaster } from "sonner";
import { WebSocketProvider } from "./context/WebSocketContextProvider";
import Game from "./Pages/Game";
import useConnectSocket from "./hooks/useConnectSocket";

export default function AppRoutes() {
  const [socket, status] = useConnectSocket();

  return (
    <WebSocketProvider websocket={socket} connectionStatus={status}>
      <main className="flex h-screen w-screen flex-col">
        <Toaster richColors={true} />
        <Routes>
          <Route path="/" Component={Landing} />
          <Route path="/game/:gameId" Component={Game} />
        </Routes>
      </main>
    </WebSocketProvider>
  );
}
