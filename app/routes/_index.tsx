import type { Route } from "./+types/_index";
import { commitSession, getSession } from "~/.server/session";
import { data, Form, Link, redirect, useFetcher } from "react-router";
import { useWs } from "~/context";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("cookie"));

  const roomId = session.get("roomId") ?? null;

  return data(
    {
      roomId,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const roomId = formData.get("roomId");
  if (!roomId) return data({ message: "Incomplete request" }, { status: 400 });

  const session = await getSession(request.headers.get("cookie"));

  session.set("roomId", roomId as string);

  return redirect("/room", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function RootPage({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const formFetcher = useFetcher();
  const ws = useWs();

  const handleRoomCreation = () => {
    if (ws) {
      const queryBody = {
        query: "create",
      };

      ws.send(JSON.stringify(queryBody));

      ws.onmessage = async (event) => {
        if (event.data.success) {
          const formData = new FormData();

          formData.set("roomId", event.data.roomId);

          await formFetcher.submit(formData, { method: "POST" });
        }
      };
    }
  };

  return (
    <main>
      {roomId ? (
        <Link to="/room">Return to room</Link>
      ) : (
        <formFetcher.Form onSubmit={handleRoomCreation}>
          <button type="submit" className="cursor-pointer">
            Create Room
          </button>
        </formFetcher.Form>
      )}
    </main>
  );
}
