import { useCallback, useEffect, useState } from "react";
import { useSocketMessaging } from "./useSocketMessaging";

type WebSocketResponse =
  | {
      event: "get_game_text";
      payload: {
        gameText: string;
      };
    }
  | {
      event: "get_game_players";
      payload: {
        players: { playerId: string; playerName: string; position: string }[];
      };
    }
  | {
      event: "player_update";
      payload: {
        playerId: string;
        position: number;
      };
    };

type Player = {
  playerId: string;
  playerName: string;
  position: number;
};

export default function useGameInProgressManagement() {
  const { socket, sendMessage } = useSocketMessaging();
  const [gameText, setGameText] = useState("");
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    sendMessage("get_game_text");
    sendMessage("get_game_players");

    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "get_game_text": {
            setGameText(data.payload.gameText);

            // mark the game as starting
            setGameStartTime(Date.now());
            break;
          }
          case "get_game_players": {
            // convert the incoming position from type string to number

            setPlayers(
              data.payload.players.map((player) => ({
                playerId: player.playerId,
                playerName: player.playerName,
                position: Number(player.position),
              })),
            );

            break;
          }
          case "player_update":
            {
              console.log("incoming player update", data.payload.position);
              // update the players object
              setPlayers((prevPlayers) =>
                prevPlayers.map((player) =>
                  player.playerId === data.payload.playerId
                    ? { ...player, position: data.payload.position }
                    : { ...player },
                ),
              );
            }

            break;
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, sendMessage]);

  const sendUpdatedPosition = useCallback(
    (position: number) => {
      sendMessage("player_update", { position });
    },
    [sendMessage],
  );

  const finishGame = useCallback(
    (wpm: number, accuracy: number, time: number) => {
      sendMessage("finish_game", {
        wpm,
        accuracy,
        time,
      });
    },
    [sendMessage],
  );

  return { gameText, sendUpdatedPosition, players, gameStartTime, finishGame };
}
