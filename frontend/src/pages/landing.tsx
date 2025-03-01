import { useWs } from "../WsContext";
import backgroundImage from "/dot_background.jpg?url";

export default function LandingPage() {
  const ws = useWs();

  return (
    <section className="flex h-full grow flex-col items-center justify-center">
      <div className="absolute inset-0 -z-10">
        <img src={backgroundImage} className="h-full w-full object-cover" />
      </div>
      <section className="flex grow flex-col items-center justify-center gap-5 px-4 py-2">
        <header>
          <h2 className="text-center font-serif text-5xl leading-14 font-bold md:text-6xl">
            The Ultimate <span className="text-blue-700">Typing</span> Showdown
          </h2>
          <h3 className="text-center text-xl font-medium md:text-2xl">
            Compete with your friends. Prove your speed
          </h3>
        </header>
        {ws ? (
          <button className="flex cursor-pointer items-center gap-1 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white transition-transform duration-200 hover:scale-105">
            <span>Create a room</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ height: "1.5rem", width: "1.5rem" }}
            >
              <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path>
            </svg>
          </button>
        ) : (
          <p className="text-red-500 italic">
            The backend seems to be down, please try again later
          </p>
        )}
      </section>
      <footer className="w-full">
        <h3 className="p-1 text-right">
          Made with 💗 by{" "}
          <a
            target="_blank"
            href="https://x.com/dhruvkaushik305"
            className="underline-offset-2 hover:underline"
          >
            Dhruv Kaushik
          </a>
        </h3>
      </footer>
    </section>
  );
}
