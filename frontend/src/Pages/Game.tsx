import { useParams } from "react-router";
import Logo from "../components/Logo";
import { Copy, Crown } from "lucide-react";
import { toast } from "sonner";
import { GameStatus } from "../types";
import useLobbyManagement from "../hooks/useLobbyManagement";
import useGameStatus from "../hooks/useGameStatus";
import { useNavigate } from "react-router";

export default function Game() {
  // fetch the gameId
  const params = useParams();
  const gameId = params.gameId;

  const navigator = useNavigate();

  if (!gameId) {
    navigator("/");
  }

  // return the default status of the game. Redirect to the landing if the game is invalid
  const { gameStatus } = useGameStatus(gameId);

  return (
    <section className="h-full px-4">
      <header className="p-2">
        <Logo />
      </header>
      {renderGameContent(gameStatus)}
    </section>
  );
}

/** A helper function that returns the component based on the status of the game */
function renderGameContent(gameStatus: GameStatus | null) {
  switch (gameStatus) {
    case GameStatus.WAITING:
      return <LobbyComponent />;
    case GameStatus.STARTING:
      return <div>The game is about to start</div>;
    case GameStatus.IN_PROGRESS:
      return <div>The game is in progress</div>;
    case GameStatus.COMPLETED:
      return <div>Game results</div>;
    default:
      return <div>Loading...</div>;
  }
}

/** Rendered when the state of the game is "waiting" */
function LobbyComponent() {
  const params = useParams();
  const gameId = params.gameId as string;

  const { startGame, leaveGame, lobby } = useLobbyManagement();

  if (!lobby) return;

  const handleStartGame = () => {
    startGame();
  };

  const handleLeaveGame = () => {
    leaveGame();
  };

  const handleCopyInviteCode = async () => {
    const copyPromise = navigator.clipboard.writeText(gameId);
    toast.promise(copyPromise, {
      loading: "Copying...",
      success: "Copied to the clipboard",
      error: "Something went wrong",
    });
  };

  const currentUserId = localStorage.getItem("playerId");

  return (
    <section className="mx-auto mt-[15vh] flex max-w-xl flex-col items-center justify-center gap-2 rounded-lg border border-zinc-100 p-2">
      <label className="flex w-full items-center gap-2">
        <span className="font-roboto text-nowrap">Invite Code</span>
        <input
          value={gameId}
          readOnly
          className="w-full rounded-md border border-zinc-200 px-2 py-1 font-mono text-sm italic"
        />
        <Copy
          className="size-5 cursor-pointer text-zinc-400 transition-colors duration-300 hover:text-black"
          onClick={handleCopyInviteCode}
        />
      </label>
      <div className="w-full max-w-md divide-y divide-zinc-100">
        {lobby.players.map((item, index) => (
          <div
            key={index}
            className="font-poppins flex w-full items-center gap-1 p-1"
          >
            {item.playerName}
            {lobby.hostId === item.playerId && <Crown className="size-4" />}
          </div>
        ))}
      </div>
      <div className="font-inter flex w-full gap-2">
        <button
          className="w-full cursor-pointer rounded-lg border-2 border-red-400 p-2 text-sm transition-colors duration-300 hover:bg-red-500 hover:text-white"
          onClick={handleLeaveGame}
        >
          Leave Game
        </button>
        {currentUserId === lobby.hostId && (
          <button
            className="w-full cursor-pointer rounded-lg bg-blue-600 p-2 text-sm text-white transition-colors duration-300 hover:bg-blue-800"
            onClick={handleStartGame}
          >
            {" "}
            Start Game
          </button>
        )}
      </div>
    </section>
  );
}
