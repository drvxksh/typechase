import { Copy, Crown } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";
import Logo from "../components/Logo";
import useGameStatus from "../hooks/useGameStatus";
import useLobbyManagement from "../hooks/useLobbyManagement";
import { GameStatus } from "../types";
import { useRef } from "react";

export default function Game() {
  return (
    <section className="h-full px-4">
      <header className="p-2">
        <Logo />
      </header>
      <RenderGameByStatus />
    </section>
  );
}

/** A helper function that returns the component based on the status of the game */
function RenderGameByStatus() {
  // fetch the gameId
  const params = useParams();
  const gameId = params.gameId;

  // validate the gameId and fetch the status and count in case the game is starting
  const { gameStatus, count } = useGameStatus(gameId);
  // const gameStatus = "starting";

  switch (gameStatus) {
    case GameStatus.WAITING:
      return <GameWaiting gameId={gameId as string} />;
    case GameStatus.STARTING:
      return <GameStarting count={count} />;
    case GameStatus.IN_PROGRESS:
      return <GameInProgress />;
    case GameStatus.COMPLETED:
      return <div>Game results</div>;
    default:
      return <div>Loading...</div>;
  }
}

/** Rendered when the state of the game is "waiting" */
function GameWaiting({ gameId }: { gameId: string }) {
  const { startGame, leaveGame, changeUsername, lobby } = useLobbyManagement();
  // TODO implement player name changing
  const handleCopyInviteCode = async () => {
    const copyPromise = navigator.clipboard.writeText(gameId);
    toast.promise(copyPromise, {
      loading: "Copying...",
      success: "Copied to the clipboard",
      error: "Something went wrong",
    });
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleLeaveGame = () => {
    leaveGame();
  };

  const playerNameInputRef = useRef<HTMLInputElement>(null);

  const handleChangeUsername = () => {
    if (playerNameInputRef.current) {
      changeUsername(playerNameInputRef.current.value);
    }
  };

  const currentUserId = localStorage.getItem("playerId");
  const isHost = currentUserId === lobby?.hostId;

  return (
    <section className="mx-auto mt-[15vh] flex max-w-xl flex-col items-center justify-center gap-5">
      <header className="flex w-full flex-col gap-5">
        <h1 className="font-inter text-center text-3xl font-semibold">
          Waiting for other players...
        </h1>
        <div
          className="flex w-full cursor-pointer items-center rounded-full px-4 py-2 outline outline-zinc-100"
          onClick={handleCopyInviteCode}
        >
          <input
            className="w-full cursor-pointer font-mono text-zinc-700 focus:outline-none"
            value={gameId}
            readOnly
          />
          <Copy className="size-5 cursor-pointer text-zinc-300 transition-colors duration-300 hover:text-zinc-600" />
        </div>
      </header>
      <section className="flex w-full flex-col gap-3 rounded-xl p-4 outline outline-zinc-100">
        <div className="flex flex-col space-y-1 divide-y divide-zinc-100">
          {lobby &&
            lobby.players.map((item) => (
              <div className="flex items-center gap-3">
                <input
                  key={item.playerId}
                  value={item.playerName}
                  className="font-poppins w-full rounded-md p-1 text-sm text-zinc-800 focus:outline-none"
                  readOnly={currentUserId !== item.playerId}
                  ref={handleChangeUsername}
                />
                {lobby.hostId === item.playerId && <Crown className="size-5" />}
              </div>
            ))}
        </div>
        <div className="mx-auto flex w-full gap-2">
          {isHost && (
            <button
              onClick={handleStartGame}
              className="font-inter w-full cursor-pointer rounded-md bg-blue-600 text-white"
            >
              Start Game
            </button>
          )}
          <button
            onClick={handleLeaveGame}
            className="font-inter w-full cursor-pointer rounded-md bg-red-500 px-4 py-2 text-white"
          >
            Leave Game
          </button>
        </div>
      </section>
    </section>
  );
}

function GameStarting({ count }: { count: string }) {
  return (
    <section className="flex h-[25vh] items-center justify-center">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        starting in {count}
      </h1>
    </section>
  );
}

function GameInProgress() {
  // periodically send the player position
  // calculate the wpm, accuracy and time
  // if i finish the race, stop the cursor for me
  // when everyone finishes, show the results page
  return <section>Game has started</section>;
}
