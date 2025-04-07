import { Route, Routes } from "react-router";
import Landing from "./Pages/Landing";
import { Toaster } from "sonner";
import useInitialiseSocket from "./hooks/useInitialiseSocket";
import { WebSocketProvider } from "./context/WebSocketContextProvider";

export default function AppRoutes() {
  const [socket, status] = useInitialiseSocket();

  return (
    <WebSocketProvider websocket={socket} connectionStatus={status}>
      <main className="flex h-screen w-screen flex-col">
        <Toaster richColors={true} />
        <Routes>
          <Route path="/" Component={Landing} />
        </Routes>
      </main>
    </WebSocketProvider>
  );
}
