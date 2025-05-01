import { useEffect, useRef, useState } from "react";
import { ConnectionStatus } from "../types";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
  const healthCheckTimeoutRef = useRef<number | null>(null);

  const navigator = useNavigate();

  useEffect(() => {
    const newSocket = new WebSocket("ws://localhost:3000");
    let connectionStatus: ConnectionStatus = "connecting";

    const startHealthCheck = (ws: WebSocket) => {
      // clear any existing intervals if any
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }

      healthCheckIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          // timeout gives another buffer to wait for the health check message. If its still not received, the connection may be broken
          healthCheckTimeoutRef.current = window.setTimeout(() => {
            console.warn("Health check timed out, conncting may be dead");
            setStatus("failed");
          }, 5000);

          // send the health check to the server
          ws.send(
            JSON.stringify({
              event: "health_check",
              payload: {},
            }),
          );
        }
      }, 10000);
    };

    const removeHealthCheckListeners = () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      if (healthCheckTimeoutRef.current) {
        clearTimeout(healthCheckTimeoutRef.current);
      }
    };

    newSocket.onopen = () => {
      // fetch the existing playerId
      const existingPlayerId = localStorage.getItem("playerId");

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
            if (healthCheckTimeoutRef.current) {
              clearTimeout(healthCheckTimeoutRef.current);
              healthCheckTimeoutRef.current = null;
            }

            break;
          }
          case "connect": {
            // save the new playerId if it differs from the existing one
            const playerId = data.payload.playerId;
            const existingPlayerId = localStorage.getItem("playerId");

            if (existingPlayerId !== playerId) {
              localStorage.setItem("playerId", playerId);
            }

            // update the state variables
            connectionStatus = "connected";
            setStatus(connectionStatus);
            setSocket(newSocket);

            // start the health check after the successfull connection
            startHealthCheck(newSocket);

            // redirect the player if it was part in the middle of a game
            if (data.payload.existingGameId) {
              toast.info("Redirecting to your game");
              navigator(`/game/${data.payload.existingGameId}`);
            }

            break;
          }
          case "error": {
            toast.error(data.payload.message);

            break;
          }
          case "disconnect": {
            toast.error("You were disconnected from the game");
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
