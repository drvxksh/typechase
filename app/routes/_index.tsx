import { useEffect } from "react";
import { useWs } from "~/context";

export default function RootPage() {
  const ws = useWs();

  useEffect(() => {
    if (!ws) return;

    console.log("socket here");
  }, [ws]);
  return <main></main>;
}
