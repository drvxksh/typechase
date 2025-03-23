import { Link, Route, Routes } from "react-router";
import { BrowserRouter } from "react-router";
import Landing from "./Pages/Landing";

function App() {
  return (
    <main className="flex h-screen w-screen flex-col">
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" Component={Landing} />
        </Routes>
      </BrowserRouter>
    </main>
  );
}

function Navbar() {
  return (
    <nav className="h-[3rem] px-2 py-1">
      <Link to="/" className="font-[Electrolize] text-2xl font-bold">
        Type<span className="text-blue-600">chase</span>
      </Link>
    </nav>
  );
}

export default App;
