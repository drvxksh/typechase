import { Copy, Info, User } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";
import Logo from "../components/Logo";
import useGameStatus from "../hooks/useGameStatus";
import useLobbyManagement from "../hooks/useLobbyManagement";
import { GameStatus } from "../types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useGameInProgressManagement from "../hooks/useGameInProgressManagement";
import useGameStartingManagement from "../hooks/useGameStartingManagement";
import useGameCompletedManagement from "../hooks/useGameCompletedManagement";

export default function Game() {
  return (
    <section className="h-full">
      <header className="border-b border-zinc-100 p-2">
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
  const { gameStatus } = useGameStatus(gameId);

  switch (gameStatus) {
    case GameStatus.WAITING:
      return <GameWaiting gameId={gameId as string} />;
    case GameStatus.STARTING:
      return <GameStarting />;
    case GameStatus.IN_PROGRESS:
      return <GameInProgress />;
    case GameStatus.COMPLETED:
      return <GameCompleted />;
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
      console.log("new username is", playerNameInputRef.current.value);
      changeUsername(playerNameInputRef.current.value);
    }
  };

  // const lobby: Lobby = {
  //   hostId: "123",
  //   players: [
  //     {
  //       playerId: "123",
  //       playerName: "User 1",
  //     },
  //     {
  //       playerId: "234",
  //       playerName: "User 2",
  //     },
  //   ],
  // };

  const currentUserId = localStorage.getItem("playerId");
  // const currentUserId = "123";
  const isHost = currentUserId === lobby?.hostId;

  return (
    <section className="mx-auto mt-[15vh] flex max-w-xl flex-col items-center justify-center gap-5">
      <header className="flex items-center gap-2">
        <Info className="size-6 text-blue-600" />
        <h1 className="font-inter font-bold text-blue-600 sm:text-2xl">
          Waiting for the host to start...
        </h1>
      </header>
      <div className="w-full">
        <h1 className="px-2 text-lg font-medium">Game Invite Code</h1>
        <div
          className="flex w-full cursor-pointer items-center rounded-full px-4 py-2 outline outline-zinc-100"
          onClick={handleCopyInviteCode}
        >
          <input
            className="w-full cursor-pointer font-mono text-sm text-zinc-700 focus:outline-none"
            value={gameId}
            readOnly
          />
          <Copy className="size-5 cursor-pointer text-zinc-300 transition-colors duration-300 hover:text-zinc-600" />
        </div>
      </div>
      <section className="flex w-full flex-col gap-1">
        <header className="px-2 text-lg font-medium">
          <h1>Current Lineup</h1>
        </header>
        <div className="flex flex-col space-y-1 divide-y divide-zinc-100 rounded-xl p-4 outline outline-zinc-100">
          {lobby &&
            lobby.players.map((item) => (
              <div className="flex items-center gap-1">
                <User className="size-5" />
                <input
                  key={item.playerId}
                  defaultValue={item.playerName}
                  className="font-poppins w-full rounded-md p-1 text-sm text-zinc-800 focus:outline-none"
                  readOnly={currentUserId !== item.playerId}
                  ref={playerNameInputRef}
                  onFocus={handleChangeUsername}
                />
                {lobby.hostId === item.playerId && (
                  <span className="text-xs">(host)</span>
                )}
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

function GameStarting() {
  const { count } = useGameStartingManagement();

  return (
    <section className="flex h-[25vh] items-center justify-center">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        Starting in {count}
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

  // calculate the accuracy
  const calculateAccuracy = useCallback((input: string, target: string) => {
    if (input.length === 0) return 100;

    let correctChars = 0;
    const inputLength = Math.min(input.length, target.length);

    for (let i = 0; i < inputLength; i++) {
      if (input[i] === target[i]) {
        correctChars++;
      }
    }

    return Math.round((correctChars / inputLength) * 100);
  }, []);

  const calculateWPM = useCallback(
    (position: number, elapsedTimeSeconds: number) => {
      if (elapsedTimeSeconds === 0) return 0;

      const words = position / 5; // a word is 5 chars on average (assumption)
      const minutes = elapsedTimeSeconds / 60;

      return Math.round(words / minutes);
    },
    [],
  );

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
    if (!gameStartTime) return;

    const intervalId = setInterval(() => {
      const currentPosition = userInput.length;

      if (currentPosition < gameText.length) {
        sendUpdatedPosition(currentPosition);
      } else {
        const finalWpm = calculateWPM(currentPosition, elapsedTime);
        const finalAccuracy = calculateAccuracy(userInput, gameText);
        finishGame(finalWpm, finalAccuracy, elapsedTime);

        clearInterval(intervalId);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [
    userInput,
    gameText,
    gameStartTime,
    elapsedTime,
    calculateWPM,
    calculateAccuracy,
    finishGame,
    sendUpdatedPosition,
  ]);

  // focus the textarea when this component loads/mounts
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, []);

  // update the input value
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // don't accept more input if the game is finished
    if (userInput.length >= gameText.length) {
      return;
    } else {
      setUserInput(e.target.value);
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

  const renderProgressBars = useMemo(() => {
    return players.map((player) => {
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
                className={`font-semibold ${
                  isCurrentPlayer ? "text-blue-600" : "text-gray-700"
                }`}
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
              className={`h-full rounded-full ${
                isCurrentPlayer ? "bg-blue-500" : "bg-gray-500"
              }`}
              style={{
                width: `${progress}%`,
                transition: "width 0.3s ease-in-out",
              }}
            ></div>
          </div>
        </div>
      );
    });
  }, [currentPlayerId, players, calculateWPM, calculateProgress, elapsedTime]);

  return (
    <section className="mt-[15vh] w-full px-4">
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
        <h3 className="mb-4 text-lg font-bold">Race in Action</h3>
        {renderProgressBars}
      </div>
    </section>
  );
}

function GameCompleted() {
  const { result, restartGame, leaveGame } = useGameCompletedManagement();

  const handleRestartGame = () => {
    restartGame();
  };

  const handleLeaveGame = () => {
    leaveGame();
  };

  return (
    <section>
      The game is now completed{" "}
      <button onClick={handleLeaveGame}>Leave Game</button>{" "}
      <button onClick={handleRestartGame}>Restart</button>
      <div>
        Game results
        {result.players.map((player) => (
          <div>
            <p>{player.name}</p>
            <p>{player.wpm}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
