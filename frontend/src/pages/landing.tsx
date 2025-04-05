import { useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import backgroundImage from "/hero_background.jpg?url";
import { Info, ServerCrash } from "lucide-react";
import useGameManagement from "../hooks/useGameManagement";

export default function Landing() {
  const { 1: status } = useWebSocket();
  const isConnected = status === "connected";
  const inviteCodeInputRef = useRef<HTMLInputElement | null>(null);

  const { createGame, joinGame } = useGameManagement();

  const handleCreateGame = () => {
    createGame();
  };

  const handleJoinGame = () => {
    if (inviteCodeInputRef.current) {
      const gameId = inviteCodeInputRef.current.value;
      joinGame(gameId);
    }
  };

  return (
    <section className="flex h-full grow flex-col items-center justify-center px-4">
      <div className="absolute inset-0 -z-10">
        <img src={backgroundImage} className="h-full w-full object-cover" />
      </div>
      <section className="flex flex-col items-center gap-5">
        <header className="flex flex-col items-center justify-center">
          <h1 className="font-heading blue-gradient-text bg-clip-text pb-2 text-center text-4xl font-bold text-transparent sm:text-5xl">
            <span className="inline-block">Words At War</span>
          </h1>
          <h2 className="font-description text-center text-sm font-medium text-zinc-700 sm:text-lg">
            Race against your friends in realtime and discover who truly is the
            fastest.
          </h2>
        </header>
        {!isConnected &&
          (status == "connecting" ? (
            <p className="flex cursor-wait items-center gap-2">
              <Info className="size-5 text-blue-500" />
              <span className="text-sm text-blue-600">
                Connecting to the server...
              </span>
            </p>
          ) : (
            <p className="flex cursor-not-allowed items-center gap-2">
              <ServerCrash className="size-5 text-zinc-400" />
              <span className="text-sm text-zinc-600">
                Could not connect with the server
              </span>
            </p>
          ))}
        {isConnected && (
          <div className="flex w-full flex-col items-center gap-1 px-4 sm:px-15 lg:px-20">
            <div
              className="flex w-full cursor-text items-center rounded-lg border-2 border-zinc-200 bg-transparent px-3 py-2 transition-colors duration-300 focus-within:border-zinc-300"
              onClick={() => {
                if (inviteCodeInputRef.current)
                  inviteCodeInputRef.current.focus();
              }}
            >
              <input
                type="text"
                name="gameId"
                placeholder="Enter the invite code..."
                ref={inviteCodeInputRef}
                className="w-full text-xs text-zinc-500 focus:outline-none sm:text-sm"
              />
              <button
                className="cursor-pointer text-xs text-zinc-500 underline-offset-2 hover:underline sm:text-sm"
                onClick={handleJoinGame}
              >
                Join
              </button>
            </div>
            <p className="text-center text-xs italic">or</p>
            <button
              className="blue-gradient-btn w-full cursor-pointer rounded-md px-3 py-2 text-xs text-white transition-transform duration-200 hover:scale-105 hover:shadow-lg sm:text-sm"
              onClick={handleCreateGame}
            >
              New Game
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
