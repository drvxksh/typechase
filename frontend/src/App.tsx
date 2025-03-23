import { Route, Routes } from "react-router";
import { BrowserRouter } from "react-router";
import Landing from "./Pages/Landing";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" Component={Landing} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
