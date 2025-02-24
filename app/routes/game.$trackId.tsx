import { useEffect, useState } from "react";
import { useWs } from "~/websockets";

export default function GamePage() {
  const ws = useWs();
  const [userName, setUserName] = useState<string | null>(null);

  return (
    <main className="h-screen flex flex-col items-center">
      <header>Waiting for Players to join</header>
      {userName && <p>Welcome, {userName}!</p>}
    </main>
  );
}
