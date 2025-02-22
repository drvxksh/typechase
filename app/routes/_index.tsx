import { Form, Link } from "react-router";
import backgroundImage from "/assets/dot_background.jpg?url";
import type { Route } from "./+types/_index";
import { getSession } from "~/.server/sessions";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("cookie"));
  const roomId = session.get("roomId");

  if (roomId) {
    return { hasGameRunning: true, roomId };
  } else return { hasGameRunning: false, roomId: null };
}

export default function RootPage({ loaderData }: Route.ComponentProps) {
  const { hasGameRunning, roomId } = loaderData;

  return (
    <main className="h-screen flex flex-col items-center justify-center">
      <div className="absolute -z-10 top-0 left-0">
        <img src={backgroundImage} className="h-screen w-screen" />
      </div>
      <Navbar />
      <section className="grow flex flex-col gap-5 justify-center items-center px-4">
        <header className="flex flex-col gap-0 md:gap-2 items-center">
          <h1 className="font-poppins font-bold text-5xl md:text-6xl leading-14 text-center">
            The Ultimate <span className="text-blue-600">Typing</span> Showdown
          </h1>
          <h2 className="font-inter font-medium text-xl md:text-2xl text-center">
            Compete with your friends. Prove your speed
          </h2>
        </header>
        {hasGameRunning ? (
          <Link to={`/${roomId}?status=lobby`}>Return to game</Link>
        ) : (
          <div className="flex gap-2 md:gap-5 items-center md:flex-row flex-col">
            <Form className="border-2 border-zinc-300 p-2 rounded-md">
              <input
                type="text"
                name="inviteLink"
                placeholder="Enter the invite url"
                className="focus:outline-none text-zinc-600"
              />
              <button
                type="submit"
                className="hover:cursor-pointer hover:underline underline-offset-4"
              >
                Join
              </button>
            </Form>
            <span className="underline underline-offset-4 italic font-mono">
              or
            </span>
            <button className="px-4 py-2 rounded-md text-lg bg-blue-600 text-white font-semibold flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform duration-200">
              Create a room{" "}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ height: "1.5rem", width: "1.5rem" }}
              >
                <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path>
              </svg>
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function Navbar() {
  return (
    <header className="h-[4rem] w-full px-4 py-2 font-pt_mono font-bold text-2xl flex items-center justify-between">
      <h1>
        Type<span className="text-blue-600">chase</span>
      </h1>
      <a
        href="https://github.com/dhruvkaushik305/typechase"
        className="hover:scale-105 transition-transform duration-200 cursor-pointer"
        target="_blank"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ width: "2.5rem", height: "2.5rem" }}
        >
          <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z"></path>
        </svg>
      </a>
    </header>
  );
}
