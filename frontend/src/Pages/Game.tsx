import { useParams } from "react-router";
import Logo from "../components/Logo";
import { Lobby } from "../types";
import { useState } from "react";
import { Copy, Crown } from "lucide-react";
import { toast } from "sonner";

// list the users
// let the user copy the invite code
// let the user leave the room

export default function Game() {
  const params = useParams();
  const gameId = params.gameId;

  const currentUserId = localStorage.getItem("playerId");

  const { 0: lobby } = useState<Lobby>({
    hostId: "123",
    players: [
      {
        playerName: "Vishesh",
        playerId: "123",
      },
      {
        playerName: "Akshat",
        playerId: "456",
      },
    ],
  });

  const handleCopyInviteCode = async () => {
    if (gameId) {
      await navigator.clipboard.writeText(gameId);
      toast.success("Copied to the clipboard");
    }
  };

  return (
    <section className="h-full px-4">
      <header className="p-2">
        <Logo />
      </header>
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
          {lobby.players.map((item) => (
            <div
              key={item.playerId}
              className="font-poppins flex w-full items-center gap-1 p-1"
            >
              {item.playerName}
              {lobby.hostId === item.playerId && <Crown className="size-4" />}
            </div>
          ))}
        </div>
        <div className="font-inter flex w-full gap-2">
          <button className="w-full cursor-pointer rounded-lg border-2 border-red-400 p-2 text-sm transition-colors duration-300 hover:bg-red-500 hover:text-white">
            Leave Game
          </button>
          {currentUserId === lobby.hostId && (
            <button className="w-full cursor-pointer rounded-lg bg-blue-600 p-2 text-sm text-white transition-colors duration-300 hover:bg-blue-800">
              {" "}
              Start Game
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
