import { Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { WebSocketProvider } from "./context/WebSocketContextProvider";
import Game from "./pages/Game";
import Landing from "./pages/Landing";

export default function AppRoutes() {
  return (
    <WebSocketProvider>
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
