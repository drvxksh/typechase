import { useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import backgroundImage from "/hero_background.jpg?url";
import { Info, ServerCrash } from "lucide-react";
import useGameManagement from "../hooks/useGameManagement";
import { Link } from "react-router";

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
    <section className="flex h-full flex-col">
      <nav className="mx-2 mt-2 flex h-14 items-center justify-between rounded-full border border-zinc-100 bg-white px-4 py-2 sm:mx-4">
        <Link
          to="/"
          className="font-courier pointer-cursor text-xl font-bold text-zinc-800 sm:text-2xl"
        >
          Type<span className="text-blue-600">chase</span>
        </Link>
        {isConnected && (
          <button
            className="blue-gradient-btn cursor-pointer rounded-full px-3 py-2 font-mono text-sm text-white transition-transform duration-200 hover:scale-105 sm:px-4 sm:py-3"
            onClick={handleCreateGame}
          >
            Play Now
          </button>
        )}
      </nav>
      <section className="flex h-full grow flex-col items-center justify-center px-4">
        <div className="absolute inset-0 -z-10">
          <img src={backgroundImage} className="h-full w-full object-cover" />
        </div>
        <section className="flex flex-col items-center gap-5">
          <header className="flex flex-col items-center justify-center">
            <h1 className="font-heading blue-gradient-text bg-clip-text text-center text-[40px] font-bold text-transparent sm:text-5xl">
              <span className="inline-block">Race Live</span>
            </h1>
            <h2 className="font-description max-w-2xl text-center text-[15px] font-medium text-zinc-700 sm:text-lg">
              A real-time multiplayer typing game. Join other rooms or create
              your own rooms — no logins, no fuss.
            </h2>
          </header>
          {!isConnected &&
            (status == "connecting" ? (
              <p className="flex cursor-wait items-center gap-1">
                <Info className="size-5 text-blue-500" />
                <span className="text-xs text-zinc-600">
                  Connecting to the server...
                </span>
              </p>
            ) : (
              <p className="flex cursor-not-allowed items-center gap-1">
                <ServerCrash className="size-5 text-red-500" />
                <span className="text-xs text-zinc-600">
                  Service temporarily unavailable. Please try again later.
                </span>
              </p>
            ))}
          {isConnected && (
            <div
              className="flex w-[18rem] cursor-text items-center rounded-full bg-transparent px-4 py-3 outline-2 outline-zinc-300 transition-all duration-200 focus-within:outline-zinc-400 sm:w-[22rem]"
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
          )}
        </section>
      </section>
    </section>
  );
}
