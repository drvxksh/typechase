import { Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { WebSocketProvider } from "./context/WebSocketContextProvider";
import useConnectSocket from "./hooks/useConnectSocket";
import Game from "./Pages/Game";
import Landing from "./Pages/Landing";

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
