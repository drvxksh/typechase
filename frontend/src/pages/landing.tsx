import { useRef, useState } from "react";
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

  const [playBtnLoader, setPlayBtnLoader] = useState<boolean>(false);
  const [joinBtnLoader, setJoinBtnLoader] = useState<boolean>(false);

  const handleCreateGame = () => {
    console.log("here");
    if (!joinBtnLoader && !joinBtnLoader) {
      setPlayBtnLoader(true);
      createGame();
      setPlayBtnLoader(false);
    }
  };

  const handleJoinGame = () => {
    console.log("here");
    if (!playBtnLoader && !joinBtnLoader) {
      if (inviteCodeInputRef.current) {
        setJoinBtnLoader(true);
        const gameId = inviteCodeInputRef.current.value;
        joinGame(gameId);
        setJoinBtnLoader(false);
      }
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
            className={`blue-gradient-btn flex h-10 w-[98px] items-center justify-center gap-1 rounded-full px-3 py-2 sm:px-4 sm:py-3 ${
              playBtnLoader || joinBtnLoader
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer transition-transform duration-200 hover:scale-105"
            }`}
            onClick={handleCreateGame}
            disabled={playBtnLoader || joinBtnLoader}
          >
            {playBtnLoader ? (
              <svg
                aria-hidden="true"
                className="h-5 w-5 animate-spin fill-zinc-100 text-blue-800"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
            ) : (
              <span className="font-mono text-sm text-nowrap text-white">
                Play Now
              </span>
            )}
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
                <span className="font-roboto text-xs text-zinc-600">
                  Connecting to the server...
                </span>
              </p>
            ) : (
              <p className="flex cursor-not-allowed items-center gap-1">
                <ServerCrash className="size-5 text-red-500" />
                <span className="font-roboto text-xs text-zinc-600">
                  Service temporarily unavailable. Please try again later.
                </span>
              </p>
            ))}
          {isConnected && (
            <div
              className={`flex w-[18rem] ${joinBtnLoader || playBtnLoader ? "cursor-not-allowed" : "cursor-text"} items-center rounded-full bg-transparent px-4 py-3 outline-2 outline-zinc-300 transition-all duration-200 focus-within:outline-zinc-400 sm:w-[22rem]`}
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
                disabled={playBtnLoader || joinBtnLoader}
                className={`${joinBtnLoader || playBtnLoader ? "cursor-not-allowed" : "cursor-text"} w-full text-xs text-zinc-500 focus:outline-none sm:text-sm`}
              />
              <button
                onClick={handleJoinGame}
                className={`${joinBtnLoader || playBtnLoader ? "cursor-not-allowed" : "cursor-pointer border-b border-transparent transition-colors duration-300 hover:border-b hover:border-zinc-500"}`}
                disabled={joinBtnLoader || playBtnLoader}
              >
                {joinBtnLoader ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin fill-zinc-400 text-zinc-300"
                    viewBox="0 0 100 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                      fill="currentColor"
                    />
                    <path
                      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                      fill="currentFill"
                    />
                  </svg>
                ) : (
                  <span
                    className={`text-xs ${playBtnLoader ? "opacity-50" : ""} text-zinc-500 sm:text-sm`}
                  >
                    Join
                  </span>
                )}
              </button>
            </div>
          )}
        </section>
      </section>
    </section>
  );
}
