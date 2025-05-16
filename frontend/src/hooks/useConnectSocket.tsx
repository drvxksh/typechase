import { useEffect, useRef, useState } from "react";
import { ConnectionStatus } from "../types";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { usePlayer } from "../context/PlayerContext";

type WebSocketResponse =
  | {
      event: "health_check";
      payload: {
        message: string;
      };
    }
  | {
      event: "connect";
      payload: {
        playerId: string;
        existingGameId: string | null;
      };
    }
  | {
      event: "error";
      payload: {
        message: string;
      };
    }
  | {
      event: "disconnect";
    };

/**
 * Establishes a websocket connection to the backend server.
 * Manages socket instance and connection state.
 * Persists user identification in localStorage.
 */
export default function useConnectSocket(): [
  WebSocket | null,
  ConnectionStatus,
] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const healthCheckIntervalRef = useRef<number | null>(null);
  const pendingHealthCheckRef = useRef<boolean>(false);

  const { playerId, setPlayerId, checkAndRestorePlayerId } = usePlayer();

  const navigator = useNavigate();

  useEffect(() => {
    const newSocket = new WebSocket("ws://localhost:3000");
    let connectionStatus: ConnectionStatus = "connecting";

    const startHealthCheck = (ws: WebSocket) => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }

      healthCheckIntervalRef.current = setInterval(() => {
        if (pendingHealthCheckRef.current) {
          // we did not hear the health check echo, fail the socket.
          setStatus("failed");

          ws.close();

          removeHealthCheckListeners();
        } else if (ws.readyState === WebSocket.OPEN) {
          pendingHealthCheckRef.current = true;

          ws.send(
            JSON.stringify({
              event: "health_check",
              payload: {},
            }),
          );
        }
      }, 5000);
    };

    const removeHealthCheckListeners = () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };

    newSocket.onopen = () => {
      // First check if playerId in localStorage was deleted and restore it if needed
      checkAndRestorePlayerId();

      // fetch the existing playerId
      const existingPlayerId = playerId;

      // connect the backend
      const payload = {
        event: "connect",
        payload: {
          playerId: existingPlayerId ? existingPlayerId : null,
        },
      };

      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.send(JSON.stringify(payload));
      }
    };

    newSocket.onclose = () => {
      setStatus("failed");

      removeHealthCheckListeners();
    };

    newSocket.onmessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);

        connectionStatus = "failed";
        setStatus(connectionStatus);
      }

      if (data) {
        switch (data.event) {
          case "health_check": {
            // clear the buffer timeout because the response was received
            pendingHealthCheckRef.current = false;

            break;
          }
          case "connect": {
            // save the new playerId if it differs from the existing one
            const newPlayerId = data.payload.playerId;
            setPlayerId(newPlayerId);

            // update the state variables
            connectionStatus = "connected";
            setStatus(connectionStatus);
            setSocket(newSocket);

            // start the health check after the successfull connection
            startHealthCheck(newSocket);

            // redirect the player if it was part in the middle of a game
            if (data.payload.existingGameId) {
              // TODO: make this functional
              toast.info("Redirecting you to your old game");
              navigator(`/game/${data.payload.existingGameId}`);
            }

            break;
          }
          case "error": {
            toast.error(data.payload.message);

            break;
          }
          case "disconnect": {
            toast.error(
              "Uh-oh! Connection dropped. You'll need to wait for the game to accept new players to jump back in!",
            );
            navigator("/");
          }
        }
      } else {
        console.error("The server returned a null response");

        connectionStatus = "failed";
        setStatus(connectionStatus);
      }
    };

    newSocket.onerror = () => {
      // the error is logged anyways when the socket errors, so directly updating the variables without logging
      connectionStatus = "failed";
      setStatus(connectionStatus);

      // clean up the timeouts
      removeHealthCheckListeners();
    };

    return () => {
      removeHealthCheckListeners();

      if (newSocket) {
        newSocket.close();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [socket, status];
}
