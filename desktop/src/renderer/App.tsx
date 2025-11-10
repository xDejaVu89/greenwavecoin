import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Trade from './pages/Trade';
import Compute from './pages/Compute';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <h1>GreenWave</h1>
          <ul>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/wallet">Wallet</Link></li>
            <li><Link to="/trade">Trade</Link></li>
            <li><Link to="/compute">Compute</Link></li>
          </ul>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/compute" element={<Compute />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
