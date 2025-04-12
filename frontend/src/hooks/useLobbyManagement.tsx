import { useEffect } from "react";
import { toast } from "sonner";
import { useSocketMessaging } from "./useSocketMessaging";

type WebSocketResponse = {
  event: "error";
  payload: {
    message: string;
  };
};

export default function useLobbyManagement() {
  const { socket, status, sendMessage } = useSocketMessaging();

  useEffect(() => {
    if (!socket || status !== "connected") return;

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      if (data.event === "error") toast.error(data.payload.message);
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, status, sendMessage]);

  const startGame = () => {
    sendMessage("start_game");
  };

  const leaveGame = () => {
    sendMessage("leave_game");
  };

  return { startGame, leaveGame };
}
