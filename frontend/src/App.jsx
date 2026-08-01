// frontend/src/App.jsx
import { useState, useEffect } from 'react';

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
    <div style={{ maxWidth: '750px', margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Demographics Platform — Simulation Lab</h1>

      {statusMsg && <p style={{ padding: '0.75rem', background: '#e2e8f0', borderRadius: '4px' }}>{statusMsg}</p>}

      {!user ? (
        <div style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
          <h2>{isRegistering ? 'Create Account' : 'User Login'}</h2>
          <form onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Username: </label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label>Email: </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Password: </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit">{isRegistering ? 'Sign Up' : 'Log In'}</button>
          </form>

          <p style={{ marginTop: '1rem' }}>
            {isRegistering ? 'Already registered?' : "Need an account?"}{' '}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setStatusMsg(''); }}
              style={{ border: 'none', background: 'none', color: 'blue', cursor: 'pointer' }}
            >
              {isRegistering ? 'Log In' : 'Sign Up'}
            </button>
          </p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p>Logged in as: <strong>{user?.username}</strong></p>
            <button onClick={handleLogout}>Log Out</button>
          </div>

          <hr />

          <h3>Create New Demographic Simulation</h3>

          <form onSubmit={handleSimulationSubmit} style={{ border: '1px solid #ddd', padding: '1.25rem', borderRadius: '6px' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold' }}>Simulation Title:</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10-Year BC Metro Growth Model" style={{ width: '100%', padding: '0.4rem' }} required />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold' }}>Target Subdivision / Region:</label>
              <input type="text" value={subdivision} onChange={(e) => setSubdivision(e.target.value)} style={{ width: '100%', padding: '0.4rem' }} required />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Base Population:</label>
                <input type="number" value={basePopulation} onChange={(e) => setBasePopulation(e.target.value)} style={{ width: '100%', padding: '0.4rem' }} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Annual Growth Rate (decimal):</label>
                <input type="number" step="0.001" value={annualGrowthRate} onChange={(e) => setAnnualGrowthRate(e.target.value)} style={{ width: '100%', padding: '0.4rem' }} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Horizon (Years):</label>
                <input type="number" value={projectionYears} onChange={(e) => setProjectionYears(e.target.value)} style={{ width: '100%', padding: '0.4rem' }} required />
              </div>
            </div>

            <button type="submit" style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Run & Save Simulation</button>
          </form>

          <hr style={{ margin: '2rem 0' }} />

          <h3>Your Saved Simulations</h3>
          {simulations.length === 0 ? (
            <p>No simulations created yet.</p>
          ) : (
            <div>
              {simulations.map((sim) => {
                let params = sim.parameters;
                let results = sim.results;

                if (typeof params === 'string') {
                  try { params = JSON.parse(params); } catch (e) { params = {}; }
                }
                if (typeof results === 'string') {
                  try { results = JSON.parse(results); } catch (e) { results = {}; }
                }

                return (
                  <div key={sim.simulation_id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', background: '#fafafa' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{sim.title}</h4>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                      <strong>Region:</strong> {params?.subdivision} | <strong>Base Pop:</strong> {params?.base_population?.toLocaleString()} | <strong>Rate:</strong> {(params?.annual_growth_rate * 100).toFixed(1)}% / yr
                    </p>
                    <p style={{ margin: '0', color: '#059669', fontWeight: 'bold' }}>
                      Projected Pop ({params?.projection_years} yrs): {results?.projected_population?.toLocaleString()} (+{results?.growth_percentage})
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}