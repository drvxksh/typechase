import backgroundImage from "/hero_background.jpg?url";

export default function Landing() {
  return (
    <section className="flex h-full grow flex-col items-center justify-center px-4">
      <div className="absolute inset-0 -z-10">
        <img src={backgroundImage} className="h-full w-full object-cover" />
      </div>
      <section>
        <header className="flex flex-col items-center justify-center">
          <h1 className="font-heading bg-gradient-to-b from-blue-500 to-blue-900 bg-clip-text pb-2 text-center text-4xl font-bold text-transparent sm:text-5xl">
            Outtype the Competition
          </h1>
          <h2 className="font-description text-center text-sm font-medium text-zinc-700 sm:text-lg">
            Race against your friends in realtime and discover who truly is the
            fastest.
          </h2>
        </header>
      </section>
    </section>
  );
}
