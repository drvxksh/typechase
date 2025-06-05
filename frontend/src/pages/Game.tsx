import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  Info,
  KeyRound,
  RotateCcw,
  Target,
  User,
} from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";
import Logo from "../components/Logo";
import useLobbyManagement from "../hooks/useLobbyManagement";
import { GameStatus } from "../types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useGameInProgressManagement from "../hooks/useGameInProgressManagement";
import useGameStartingManagement from "../hooks/useGameStartingManagement";
import useGameCompletedManagement from "../hooks/useGameCompletedManagement";
import useGameStatus from "../hooks/useGameStatus";

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

  const handleChangeUsername = (
    event: React.FocusEvent<HTMLInputElement>,
    orignalName: string,
  ) => {
    const newUsername = event.target.value.trim();

    if (!newUsername) {
      event.target.value = orignalName;
      toast.error("Username cannot be empty");
      return;
    }

    if (newUsername !== orignalName) {
      changeUsername(newUsername);
    }
  };

  const currentUserId = localStorage.getItem("playerId");
  const isHost = currentUserId === lobby?.hostId;

  return (
    <section className="mx-auto mt-[15vh] flex max-w-xl flex-col items-center justify-center gap-5 px-4">
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
              <div className="flex items-center gap-1" key={item.playerId}>
                <User className="size-5" />
                <input
                  defaultValue={item.playerName}
                  className={`font-poppins w-full rounded-md p-1 text-sm text-zinc-800 focus:outline-none ${currentUserId !== item.playerId ? "cursor-default" : ""}`}
                  readOnly={currentUserId !== item.playerId}
                  onBlur={(e) =>
                    currentUserId === item.playerId
                      ? handleChangeUsername(e, item.playerName)
                      : undefined
                  }
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
              className="font-inter w-full cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-white"
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
        {count ? (
          <span>Starting in {count}</span>
        ) : (
          <span>Getting things ready...</span>
        )}
      </h1>
    </section>
  );
}

function GameInProgress() {
  const { gameText, sendUpdatedPosition, players, gameStartTime, finishGame } =
    useGameInProgressManagement();

  const [userInput, setUserInput] = useState("");
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const elapsedTimerIntervalIdRef = useRef<NodeJS.Timeout>(null);
  const elapsedTimeRef = useRef(0);
  const [isTextAreaFocused, setIsTextAreaFocused] = useState(true);
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
    elapsedTimerIntervalIdRef.current = setInterval(() => {
      if (gameStartTime) {
        const newTime = (Date.now() - gameStartTime) / 1000;
        elapsedTimeRef.current = newTime;
      }
    }, 100);

    return () => {
      if (elapsedTimerIntervalIdRef.current) {
        clearInterval(elapsedTimerIntervalIdRef.current);
      }
      elapsedTimerIntervalIdRef.current = null;
    };
  }, [gameStartTime]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const input = userInputRef.current?.value || "";
      const currentPosition = input.length;

      sendUpdatedPosition(currentPosition);

      if (currentPosition >= gameText.length) {
        const finalWpm = calculateWPM(currentPosition, elapsedTimeRef.current);
        const finalAccuracy = calculateAccuracy(input, gameText);
        finishGame(finalWpm, finalAccuracy, elapsedTimeRef.current);

        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [
    calculateAccuracy,
    calculateWPM,
    finishGame,
    gameText,
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
    if (!elapsedTimerIntervalIdRef.current) {
      // the game is already done, return;
      return;
    }

    const newInput = e.target.value;

    if (newInput.length === gameText.length) {
      if (elapsedTimerIntervalIdRef.current) {
        clearInterval(elapsedTimerIntervalIdRef.current);
        elapsedTimerIntervalIdRef.current = null;
      }
    }

    if (newInput.length > gameText.length) {
      return;
    } else {
      setUserInput(newInput);
    }
  };

  const handleFocus = () => {
    setIsTextAreaFocused(true);
  };

  const handleBlur = () => {
    setIsTextAreaFocused(false);
  };

  const handleOverlayClick = () => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
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

      const wpm = calculateWPM(player.position, elapsedTimeRef.current);

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
  }, [
    currentPlayerId,
    players,
    calculateWPM,
    calculateProgress,
    elapsedTimeRef,
  ]);

  return (
    <section className="mt-[15vh] w-full px-4">
      <div className="relative font-mono text-lg leading-relaxed">
        <div className="rounded p-4 whitespace-pre-wrap outline outline-zinc-200">
          {renderText}
        </div>
        <textarea
          ref={(el) => {
            textAreaRef.current = el;
            userInputRef.current = el;
          }}
          value={userInput}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          spellCheck={false}
          className="absolute top-0 left-0 h-full w-full resize-none p-4 opacity-0 outline-none"
        />
      </div>
      <div className="mt-8 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-4 text-lg font-bold">Race in Action</h3>
        {renderProgressBars}
      </div>

      {/* Blur overlay - only shown when textarea is not focused */}
      {!isTextAreaFocused && (
        <div
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-gray-800/50 backdrop-blur-sm"
        >
          <div className="rounded-lg bg-white p-6 text-center shadow-lg">
            <p className="text-xl font-bold">Click here to resume</p>
            <p className="mt-2 text-gray-600">
              You've lost focus from the typing area
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function GameCompleted() {
  type SortField = "position" | "wpm" | "accuracy" | "time";
  type SortDirection = "asc" | "desc";

  const { result, restartGame, leaveGame } = useGameCompletedManagement();

  const [sortField, setSortField] = useState<SortField>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const currentUserId = localStorage.getItem("playerId");
  const isHost = currentUserId === result.hostId;
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "time" ? "asc" : "desc");
    }
  };

  const currentUser = result.players.find(
    (player) => player.id === currentUserId,
  );

  const sortedPlayers = [...result.players].sort((a, b) => {
    let comparision = 0;
    if (sortField === "position") {
      comparision = a.position - b.position;
    } else if (sortField === "wpm") {
      comparision = b.wpm - a.wpm;
    } else if (sortField === "accuracy") {
      comparision = b.accuracy - a.accuracy;
    } else if (sortField === "time") {
      comparision = a.time - b.time;
    }

    return sortDirection === "asc" ? comparision : -comparision;
  });

  const getPositionLabel = (position: number) => `P${position}`;

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const handleRestartGame = () => {
    restartGame();
  };

  const handleLeaveGame = () => {
    leaveGame();
  };

  return (
    <section className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">Race Complete!</h1>
          <p className="text-zinc-400">Final standings for your typing race</p>
        </div>

        {/* Current User Stats */}
        {currentUser && (
          <div className="mb-8 overflow-hidden rounded-lg shadow outline outline-zinc-100">
            <header className="bg-zinc-200/40 p-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Results
              </div>
            </header>
            <div className="p-6">
              <div className="flex flex-col items-center gap-6 md:flex-row">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200/20">
                    <div className="text-3xl font-bold">
                      {getPositionLabel(currentUser.position)}
                    </div>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="font-poppins text-2xl font-bold">
                    {currentUser.name}
                  </h2>
                  <p className="mb-2 text-zinc-700">
                    {currentUser.position === 1
                      ? "Winner!"
                      : currentUser.position === 2
                        ? "Runner-up!"
                        : currentUser.position === 3
                          ? "Podium Finish!"
                          : `Finished ${getPositionLabel(currentUser.position)}`}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center md:items-start">
                      <div className="flex items-center gap-1 text-sm text-zinc-700">
                        <KeyRound className="h-4 w-4" />
                        <span>WPM</span>
                      </div>
                      <span className="text-xl font-bold">
                        {currentUser.wpm}
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                      <div className="flex items-center gap-1 text-sm text-zinc-700">
                        <Target className="h-4 w-4" />
                        <span>Accuracy</span>
                      </div>
                      <span className="text-xl font-bold">
                        {currentUser.accuracy}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                      <div className="flex items-center gap-1 text-sm text-zinc-700">
                        <Clock className="h-4 w-4" />
                        <span>Time</span>
                      </div>
                      <span className="text-xl font-bold">
                        {currentUser.time}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="font-inter mb-8">
          <div className="pb-2">
            <h1 className="font-semibold">Leaderboard</h1>
          </div>
          <div className="rounded-lg p-3 outline outline-zinc-100">
            {/* Sortable header */}
            <div className="mb-4 grid grid-cols-7 gap-2 text-sm font-medium">
              <div className="col-span-1">Position</div>
              <div className="col-span-2">Player</div>
              <div
                className="col-span-1 flex cursor-pointer items-center gap-1"
                onClick={() => handleSort("wpm")}
              >
                WPM <SortIndicator field="wpm" />
              </div>
              <div
                className="col-span-1 flex cursor-pointer items-center gap-1"
                onClick={() => handleSort("accuracy")}
              >
                Accuracy <SortIndicator field="accuracy" />
              </div>
              <div
                className="col-span-1 flex cursor-pointer items-center gap-1"
                onClick={() => handleSort("time")}
              >
                Time <SortIndicator field="time" />
              </div>
              <div
                className="col-span-1 flex cursor-pointer items-center gap-1"
                onClick={() => handleSort("position")}
              >
                Rank <SortIndicator field="position" />
              </div>
            </div>

            {/* Leaderboard rows */}
            <div className="space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`grid grid-cols-7 items-center gap-2 rounded-md p-3 text-sm outline outline-zinc-50 ${player.id === currentUserId ? "bg-zinc-100" : ""}`}
                >
                  <div className="col-span-1 font-bold">
                    {getPositionLabel(player.position)}
                  </div>
                  <div className="col-span-2 flex items-center gap-2 font-medium">
                    {player.id === currentUserId && (
                      <User className="h-4 w-4" />
                    )}
                    {player.name}
                  </div>
                  <div className="col-span-1">{player.wpm}</div>
                  <div className="col-span-1">{player.accuracy}%</div>
                  <div className="col-span-1">{player.time}s</div>
                  <div className="col-span-1">
                    {player.position === 1 ? (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Crown className="h-4 w-4" /> 1
                      </div>
                    ) : (
                      `${player.position}`
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="font-inter flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={handleLeaveGame}
            className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-3 text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Leave Race
          </button>
          {isHost && (
            <button
              onClick={handleRestartGame}
              className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-3 text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Race Again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
