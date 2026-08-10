// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Auth States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Simulation Form States
  const [title, setTitle] = useState('');
  const [subdivision, setSubdivision] = useState('British Columbia');
  const [basePopulation, setBasePopulation] = useState('5500000');
  const [annualGrowthRate, setAnnualGrowthRate] = useState('0.015');
  const [projectionYears, setProjectionYears] = useState('10');

  // Saved Simulations List
  const [simulations, setSimulations] = useState([]);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((data) => {
        setUser(data.user);
        fetchSimulations();
      })
      .catch(() => setUser(null));
  }, []);

  const fetchSimulations = () => {
    fetch('/api/simulations')
      .then((res) => res.json())
      .then((data) => setSimulations(data.simulations || []))
      .catch((err) => console.error(err));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    const payload = isRegistering ? { username, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');

      if (isRegistering) {
        setStatusMsg('Account created! Please log in.');
        setIsRegistering(false);
      } else {
        setUser({ username: data.username });
        fetchSimulations();
      }
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setSimulations([]);
  };

  // Submit and Execute Simulation
  const handleSimulationSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');

    try {
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subdivision,
          basePopulation,
          annualGrowthRate,
          projectionYears
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatusMsg('Simulation generated and saved to database!');
      setTitle('');
      fetchSimulations();
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Demographics Platform — Simulation Lab</h1>
      </header>

      {statusMsg && <div className="status-banner">{statusMsg}</div>}

      {!user ? (
        <div className="card">
          <h2>{isRegistering ? 'Create Account' : 'User Login'}</h2>
          <form onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <div className="form-group">
                <label>Username</label>
                <input className="form-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit">{isRegistering ? 'Sign Up' : 'Log In'}</button>
          </form>

          <p style={{ marginTop: '1rem' }}>
            {isRegistering ? 'Already registered?' : "Need an account?"}{' '}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setStatusMsg(''); }}
              style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
            >
              {isRegistering ? 'Log In' : 'Sign Up'}
            </button>
          </p>
        </div>
      ) : (
        <div>
          <div className="user-bar">
            <p>Logged in as: <strong>{user?.username}</strong></p>
            <button className="btn-secondary" onClick={handleLogout}>Log Out</button>
          </div>

          <div className="card">
            <h3>Create New Demographic Simulation</h3>
            <form onSubmit={handleSimulationSubmit}>
              <div className="form-group">
                <label>Simulation Title</label>
                <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10-Year BC Metro Growth Model" required />
              </div>

              <div className="form-group">
                <label>Target Subdivision / Region</label>
                <input className="form-input" type="text" value={subdivision} onChange={(e) => setSubdivision(e.target.value)} required />
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Base Population</label>
                  <input className="form-input" type="number" value={basePopulation} onChange={(e) => setBasePopulation(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Growth Rate (decimal)</label>
                  <input className="form-input" type="number" step="0.001" value={annualGrowthRate} onChange={(e) => setAnnualGrowthRate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Horizon (Years)</label>
                  <input className="form-input" type="number" value={projectionYears} onChange={(e) => setProjectionYears(e.target.value)} required />
                </div>
              </div>

              <button className="btn-primary" type="submit">Run & Save Simulation</button>
            </form>
          </div>

          <div className="card">
            <h3>Your Saved Simulations</h3>
            {simulations.length === 0 ? (
              <p>No simulations created yet.</p>
            ) : (
              simulations.map((sim) => {
                let params = sim.parameters;
                let results = sim.results;

                if (typeof params === 'string') {
                  try { params = JSON.parse(params); } catch (e) { params = {}; }
                }
                if (typeof results === 'string') {
                  try { results = JSON.parse(results); } catch (e) { results = {}; }
                }

                return (
                  <div key={sim.simulation_id} className="sim-card">
                    <h4>{sim.title}</h4>
                    <div className="sim-meta">
                      <strong>Region:</strong> {params?.subdivision} | <strong>Base Pop:</strong> {params?.base_population?.toLocaleString()} | <strong>Rate:</strong> {(params?.annual_growth_rate * 100).toFixed(1)}% / yr
                    </div>
                    <div className="sim-result">
                      Projected Pop ({params?.projection_years} yrs): {results?.projected_population?.toLocaleString()} (+{results?.growth_percentage})
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}