import { Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { WebSocketProvider } from "./context/WebSocketContextProvider";
import Game from "./Pages/Game";
import Landing from "./Pages/Landing";
import { PlayerProvider } from "./context/PlayerContext";

export default function AppRoutes() {
  return (
    <PlayerProvider>
      <WebSocketProvider>
        <main className="flex h-screen w-screen flex-col">
          <Toaster richColors={true} />
          <Routes>
            <Route path="/" Component={Landing} />
            <Route path="/game/:gameId" Component={Game} />
          </Routes>
        </main>
      </WebSocketProvider>
    </PlayerProvider>
  );
}
