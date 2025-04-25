import { Copy, Crown } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";
import Logo from "../components/Logo";
import useGameStatus from "../hooks/useGameStatus";
import useLobbyManagement from "../hooks/useLobbyManagement";
import { GameStatus } from "../types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useGameInProgressManagement from "../hooks/useGameInProgressManagement";

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
                  defaultValue={item.playerName}
                  className="font-poppins w-full rounded-md p-1 text-sm text-zinc-800 focus:outline-none"
                  readOnly={currentUserId !== item.playerId}
                  ref={playerNameInputRef}
                  onFocus={handleChangeUsername}
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
  const { gameText, sendUpdatedPosition, players, gameStartTime, finishGame } =
    useGameInProgressManagement();

  const [userInput, setUserInput] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const currentPlayerId = localStorage.getItem("playerId");

  // update the elapsedTime
  useEffect(() => {
    const timer = setInterval(() => {
      if (gameStartTime) {
        setElapsedTime((Date.now() - gameStartTime) / 1000);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [gameStartTime]);

  // periodically send in the updated position of the client
  useEffect(() => {
    const currentPosition = userInput.length;

    // only send the updates if the game is still in progress
    if (currentPosition < gameText.length) {
      sendUpdatedPosition(currentPosition);

      const intervalId = setInterval(() => {
        sendUpdatedPosition(userInput.length);
      }, 5000); // send every 5 seconds

      return () => clearInterval(intervalId);
    }
  }, [userInput, sendUpdatedPosition, gameText.length]);

  // focus the textarea when this component loads/mounts
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, []);

  // calculate the accuracy
  const calculateAccuracy = (input: string, target: string) => {
    if (input.length === 0) return 100;

    let correctChars = 0;
    const inputLength = Math.min(input.length, target.length);

    for (let i = 0; i < inputLength; i++) {
      if (input[i] === target[i]) {
        correctChars++;
      }
    }

    return Math.round((correctChars / inputLength) * 100);
  };

  // update the input value
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // don't accept more input if the game is finished
    if (userInput.length >= gameText.length) return;

    const newInput = e.target.value;
    setUserInput(newInput);

    // check if the player has finished the text
    if (newInput.length >= gameText.length) {
      // calculate the metrics and send to finishGame
      const finalWpm = calculateWPM(newInput.length, elapsedTime);
      const finalAccuracy = calculateAccuracy(newInput, gameText);

      finishGame(finalWpm, finalAccuracy, elapsedTime);
    }
  };

  // a custom-char renderer for distinguishing between other characters
  const renderText = useMemo(() => {
    return gameText.split("").map((char, index) => {
      let className = "text-zinc-400"; // non typed text

      if (index < userInput.length) {
        // character has been typed
        className =
          userInput[index] === char
            ? "text-black" // correctly typed
            : "text-red-500"; // incorrectly typed
      } else if (index === userInput.length) {
        className = "text-zinc-400 border-b-2 border-blue-500 animate-pulse"; // sort of a typing indicator
      }

      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  }, [gameText, userInput]);

  const calculateProgress = useCallback(
    (position: number) => {
      return (position / gameText.length) * 100;
    },
    [gameText.length],
  );

  const calculateWPM = useCallback(
    (position: number, elapsedTimeSeconds: number) => {
      if (elapsedTimeSeconds === 0) return 0;

      const words = position / 5; // a word is 5 chars on average
      const minutes = elapsedTimeSeconds / 60;
      return Math.round(words / minutes);
    },
    [],
  );

  const renderProgressBars = useMemo(() => {
    return Object.values(players).map((player) => {
      const progress = calculateProgress(player.position);

      // Check if this player is the current player using the playerId field
      const isCurrentPlayer =
        currentPlayerId && player.playerId === currentPlayerId;

      const wpm = calculateWPM(player.position, elapsedTime);

      return (
        <div key={player.playerId} className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center">
              {isCurrentPlayer && <span className="mr-2 text-blue-500">►</span>}
              <span
                className={`font-semibold ${isCurrentPlayer ? "text-blue-600" : "text-gray-700"}`}
              >
                {player.playerName || `Player ${player.playerId.slice(0, 4)}`}
              </span>
            </div>
            <div className="flex items-center">
              <span className="mr-3 rounded bg-gray-100 px-2 py-1 text-xs">
                {wpm} WPM
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${isCurrentPlayer ? "bg-blue-500" : "bg-gray-500"}`}
              style={{
                width: `${progress}%`,
                transition: "width 0.3s ease-in-out",
              }}
            ></div>
          </div>
        </div>
      );
    });
  }, [calculateWPM, calculateProgress, currentPlayerId, elapsedTime, players]);

  return (
    <section className="mt-[15vh] w-full">
      <div className="relative font-mono text-lg leading-relaxed">
        <div className="rounded p-4 whitespace-pre-wrap outline outline-zinc-200">
          {renderText}
        </div>
        <textarea
          ref={textAreaRef}
          value={userInput}
          onChange={handleInputChange}
          spellCheck={false}
          className="absolute top-0 left-0 h-full w-full resize-none p-4 opacity-0 outline-none"
        />
      </div>

      <div className="mt-8 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-4 text-lg font-bold">Race Progress</h3>
        {renderProgressBars}
      </div>
    </section>
  );
}
