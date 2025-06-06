import { useEffect, useState } from "react";
import { useSocketMessaging } from "./useSocketMessaging";
import { Lobby } from "../types";
import { useNavigate } from "react-router";

type WebSocketResponse =
  | {
      event: "get_lobby";
      payload: {
        lobby: Lobby;
      };
    }
  | {
      event: "new_player_joined";
      payload: {
        newPlayerInfo: {
          playerId: string;
          playerName: string;
        };
      };
    }
  | {
      event: "username_changed";
      payload: {
        updatedPlayer: {
          playerId: string;
          playerName: string;
        };
      };
    }
  | {
      event: "player_left";
      payload: {
        updatedHostId: string;
        playerId: string;
      };
    }
  | {
      event: "leave_game";
    };

/**
 * Manages the game lobby
 * - retrieves the lobby of the game
 * - updates the lobby when a new user joins or an existing user changes its name
 * - sends start/leave messages to the backend when required
 */
export default function useLobbyManagement() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const { socket, sendMessage } = useSocketMessaging();

  const navigator = useNavigate();

  useEffect(() => {
    if (!socket) {
      return;
    }

    // fetch the lobby of the game
    sendMessage("get_lobby");

    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "get_lobby": {
            setLobby(data.payload.lobby);

            break;
          }

          case "new_player_joined": {
            setLobby((prevLobby) => {
              if (!prevLobby) return prevLobby;

              return {
                ...prevLobby,
                players: [
                  ...prevLobby.players,
                  {
                    playerId: data.payload.newPlayerInfo.playerId,
                    playerName: data.payload.newPlayerInfo.playerName,
                  },
                ],
              };
            });

            break;
          }

          case "username_changed": {
            setLobby((prevLobby) => {
              if (!prevLobby) return prevLobby;

              const newPlayers = prevLobby.players.map((player) =>
                player.playerId === data.payload.updatedPlayer.playerId
                  ? {
                      ...player,
                      playerName: data.payload.updatedPlayer.playerName,
                    }
                  : player,
              );

              return {
                hostId: prevLobby.hostId,
                players: newPlayers,
              };
            });

            break;
          }

          case "player_left": {
            setLobby((prevLobby) => {
              if (!prevLobby) return prevLobby;

              return {
                hostId: data.payload.updatedHostId,
                players: prevLobby.players.filter(
                  (player) => player.playerId !== data.payload.playerId,
                ),
              };
            });

            break;
          }

          case "leave_game": {
            // successfully exited the game. redirect to the landing page
            navigator("/");
            break;
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, sendMessage]);

  const startGame = () => {
    sendMessage("start_game");
  };

  const leaveGame = () => {
    sendMessage("leave_game");
  };

  const changeUsername = (newUsername: string) => {
    sendMessage("change_username", {
      newUsername,
    });

    // Optimistically update the lobby state
    setLobby((prevLobby) => {
      if (!prevLobby) return prevLobby;

      const newPlayers = prevLobby.players.map((player) =>
        player.playerId === localStorage.getItem("playerId")
          ? { ...player, playerName: newUsername }
          : player,
      );

      return { ...prevLobby, players: newPlayers };
    });
  };

  return { startGame, leaveGame, changeUsername, lobby };
}
