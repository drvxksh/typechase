import backgroundImage from "/hero_background.jpg?url";

export default function Landing() {
  return (
    <section className="flex h-full grow flex-col items-center justify-center px-4">
      <div className="absolute inset-0 -z-10">
        <img src={backgroundImage} className="h-full w-full object-cover" />
      </div>
      <section className="flex flex-col items-center gap-5">
        <header className="flex flex-col items-center justify-center">
          <h1 className="font-heading blue-gradient-text bg-clip-text pb-2 text-center text-4xl font-bold text-transparent sm:text-5xl">
            <span className="inline-block">Outtype the Competition</span>
          </h1>
          <h2 className="font-description text-center text-sm font-medium text-zinc-700 sm:text-lg">
            Race against your friends in realtime and discover who truly is the
            fastest.
          </h2>
        </header>
        <div className="flex flex-col items-center gap-1">
          <form className="w-[60vw] max-w-md">
            <input
              type="text"
              name="gameId"
              placeholder="enter the invite code"
              className="w-full rounded-md border-2 border-zinc-200 px-3 py-2 text-xs text-zinc-700 transition-colors duration-300 focus:border-blue-600 focus:outline-none"
            />
          </form>
          <p className="text-center text-xs italic">or</p>
          <button className="blue-gradient-btn w-[60vw] max-w-md cursor-pointer rounded-md px-3 py-2 text-xs text-white transition-transform duration-300 hover:scale-105 sm:text-sm">
            Create Room
          </button>
        </div>
      </section>
    </section>
  );
}
