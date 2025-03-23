import backgroundImage from "/hero_background.jpg?url";

export default function Landing() {
  return (
    <section className="flex h-full grow flex-col items-center justify-center">
      <div className="absolute inset-0 -z-10">
        <img src={backgroundImage} className="h-full w-full object-cover" />
      </div>
      <section>
        <header className="space-y-2">
          <h1 className="font-[Roboto] text-5xl font-bold">
            Fastest fingers first
          </h1>
          <h2 className="text-center">
            A multiplayer typing game to prove your speed
          </h2>
        </header>
      </section>
    </section>
  );
}
