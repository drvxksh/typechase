import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSocketMessaging } from "./useSocketMessaging";
import { Lobby } from "../types";

type WebSocketResponse =
  | {
      event: "error";
      payload: {
        message: string;
      };
    }
  | {
      event: "get_lobby";
      payload: {
        lobby: Lobby;
      };
    }
  | {
      event: "new_player_joined";
      payload: {
        newUser: {
          playerId: string;
          playerName: string;
        };
      };
    }
  | {
      event: "username_changed";
      payload: {
        updatedUser: {
          playerId: string;
          playerName: string;
        };
      };
    };

/**
 * custom hook to manage the lobby
 * - retrieves the lobby of the game
 * - updates the lobby when a new user joins or an existing user changes its name
 * - sends start/leave messages to the backend when required
 */
export default function useLobbyManagement() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const { socket, sendMessage } = useSocketMessaging();

  useEffect(() => {
    if (!socket) return;

    // request for the initial Lobby
    sendMessage("get_lobby");

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      if (data.event === "error") toast.error(data.payload.message);

      if (data.event === "get_lobby") setLobby(data.payload.lobby);

      if (data.event === "new_player_joined") {
        // this event indicates that there is a new user in the Lobby
        setLobby((prevLobby) => {
          if (!prevLobby) return prevLobby;
          return {
            ...prevLobby,
            players: [
              ...prevLobby.players,
              {
                playerId: data.payload.newUser.playerId,
                playerName: data.payload.newUser.playerName,
              },
            ],
          };
        });
      }

      if (data.event === "username_changed") {
        // this event indicates that a user changed its playerName
        setLobby((prevLobby) => {
          if (!prevLobby) return prevLobby;
          return {
            ...prevLobby,
            players: prevLobby.players.map((player) =>
              player.playerId === data.payload.updatedUser.playerId
                ? { ...player, name: data.payload.updatedUser.playerName }
                : player,
            ),
          };
        });
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, sendMessage]);

  const startGame = () => {
    sendMessage("start_game");
  };

  const leaveGame = () => {
    sendMessage("leave_game");
  };

  return { startGame, leaveGame, lobby };
}
