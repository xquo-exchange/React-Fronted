import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Graph from "./components/Graph";
import Header from "./components/Header";
import SwapBox from "./components/SwapBox";

function App() {
  return (
    <div className="app-layout">
      <Navbar />
      <Header />
      <div className="main-content">
        <Sidebar />
        <Graph />
      </div>
      <SwapBox/>
    </div>
  );
}

export default App;
