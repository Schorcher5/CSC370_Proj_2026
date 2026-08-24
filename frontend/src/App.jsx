// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './App.css';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Auth States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Mode Selection
  const [activeTab, setActiveTab] = useState('sim');

  // Simulation Form States
  const [simType, setSimType] = useState('exponential_growth');
  const [title, setTitle] = useState('');
  const [subdivisionName, setSubdivisionName] = useState('British Columbia');
  const [annualGrowthRate, setAnnualGrowthRate] = useState('0.02');
  const [projectionYears, setProjectionYears] = useState('10');
  const [incomeMode, setIncomeMode] = useState('household');

  // CSV State
  const [csvFile, setCsvFile] = useState(null);
  const [csvTitle, setCsvTitle] = useState('');

  // Saved Data & Modal State
  const [simulations, setSimulations] = useState([]);
  const [activeChartSim, setActiveChartSim] = useState(null);

  // Visual Natural Join State (Select 2 simulations)
  const [selectedForJoin, setSelectedForJoin] = useState([]);
  const [activeJoinedVisual, setActiveJoinedVisual] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
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
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (isRegistering) {
        setStatusMsg('Account registered! Please log in.');
        setIsRegistering(false);
      } else {
        setUser({ username: data.username });
        fetchSimulations();
      }
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleSimulationSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('Executing simulation scenario...');

    try {
      const payload = {
        simType,
        title,
        subdivisionName,
        annualGrowthRate: simType === 'exponential_growth' ? annualGrowthRate : undefined,
        projectionYears: simType === 'exponential_growth' ? projectionYears : undefined,
        customDistributions: { incomeMode }
      };

      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      setStatusMsg(data.message || 'Simulation created successfully!');
      setTitle('');
      fetchSimulations();
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile) return setStatusMsg('Please select a CSV file first.');

    const formData = new FormData();
    formData.append('csvFile', csvFile);
    formData.append('title', csvTitle || csvFile.name);

    try {
      const res = await fetch('/api/simulations/upload-csv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV ingestion failed');

      setStatusMsg(data.message || 'CSV parsed and ingested successfully!');
      setCsvTitle('');
      setCsvFile(null);
      e.target.reset();
      fetchSimulations();
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setSimulations([]);
    setSelectedForJoin([]);
  };

  // Toggle selection checkbox for joining
  const handleToggleSelectForJoin = (simId) => {
    if (selectedForJoin.includes(simId)) {
      setSelectedForJoin(selectedForJoin.filter(id => id !== simId));
    } else {
      if (selectedForJoin.length >= 2) {
        setSelectedForJoin([selectedForJoin[1], simId]); // keep the latest two
      } else {
        setSelectedForJoin([...selectedForJoin, simId]);
      }
    }
  };

  // -------------------------------------------------------------
  // VISUAL NATURAL JOIN LOGIC
  // -------------------------------------------------------------
  const executeVisualJoin = () => {
    if (selectedForJoin.length !== 2) {
      setStatusMsg('Please check exactly 2 datasets to execute a visual join.');
      return;
    }

    const simA = simulations.find(s => s.simulation_id === selectedForJoin[0]);
    const simB = simulations.find(s => s.simulation_id === selectedForJoin[1]);

    const paramsA = typeof simA.parameters === 'string' ? JSON.parse(simA.parameters) : simA.parameters;
    const resultsA = typeof simA.results === 'string' ? JSON.parse(simA.results) : simA.results;
    const paramsB = typeof simB.parameters === 'string' ? JSON.parse(simB.parameters) : simB.parameters;
    const resultsB = typeof simB.results === 'string' ? JSON.parse(simB.results) : simB.results;

    // Case 1: Join Time-Series on Natural Key: `year`
    if (resultsA.time_series && resultsB.time_series) {
      const mapB = new Map(resultsB.time_series.map(item => [item.year, item.simulated]));
      
      const joinedData = resultsA.time_series.map(itemA => ({
        year: itemA.year,
        [simA.title]: itemA.simulated,
        [simB.title]: mapB.get(itemA.year) || null,
        'Census Baseline': itemA.baseline
      }));

      setActiveJoinedVisual({
        type: 'time_series_join',
        title: `Natural Join (Key: year): "${simA.title}" ⨝ "${simB.title}"`,
        simAName: simA.title,
        simBName: simB.title,
        data: joinedData
      });
      return;
    }

    // Case 2: Join Cohorts on Natural Key: `age_bracket`
    const cohortsA = resultsA.cohort_breakdown || [];
    const cohortsB = resultsB.cohort_breakdown || [];

    if (cohortsA.length > 0 && cohortsB.length > 0) {
      const mapB = new Map(cohortsB.map(i => [i.age_bracket, (i.male || 0) + (i.female || 0)]));
      
      const joinedData = cohortsA.map(itemA => ({
        age_bracket: itemA.age_bracket,
        [`${simA.title} (Total)`]: (itemA.male || 0) + (itemA.female || 0),
        [`${simB.title} (Total)`]: mapB.get(itemA.age_bracket) || 0
      }));

      setActiveJoinedVisual({
        type: 'cohort_join',
        title: `Natural Join (Key: age_bracket): "${simA.title}" ⨝ "${simB.title}"`,
        simAName: `${simA.title} (Total)`,
        simBName: `${simB.title} (Total)`,
        data: joinedData
      });
      return;
    }

    setStatusMsg('Selected datasets do not share a common schema attribute to natural join (requires matching time-series years or age brackets).');
  };

  // Helper to render single Recharts visual
  const renderSimulationChart = (sim) => {
    let params = typeof sim.parameters === 'string' ? JSON.parse(sim.parameters) : sim.parameters || {};
    let results = typeof sim.results === 'string' ? JSON.parse(sim.results) : sim.results || {};

    const type = params.sim_type || 'exponential_growth';

    if (type === 'exponential_growth') {
      let data = results.time_series;
      if (!data || data.length === 0) {
        const basePop = Number(params.base_population || params.sample_size) || 5500000;
        const rate = parseFloat(params.annual_growth_rate || params.growth_rate) || 0.015;
        const years = parseInt(params.projection_years || params.years) || 10;
        const startYear = Number(params.baseline_year) || 2026;

        data = [];
        for (let i = 0; i <= years; i++) {
          data.push({
            year: startYear + i,
            baseline: Math.round(basePop * Math.pow(1.008, i)),
            simulated: Math.round(basePop * Math.pow(1 + rate, i))
          });
        }
      }

      return (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend />
              <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeDasharray="4 4" name="Baseline" />
              <Line type="monotone" dataKey="simulated" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} name="Projected" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'wealth_distribution' && results.distribution_data) {
      return (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={results.distribution_data}
                dataKey="population"
                nameKey="bracket"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                label={(entry) => `${entry.bracket}`}
              >
                {results.distribution_data.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'age_gender_cohort' && results.cohort_breakdown) {
      return (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={results.cohort_breakdown} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age_bracket" />
              <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend />
              <Bar dataKey="male" fill="#3b82f6" name="Male Population" />
              <Bar dataKey="female" fill="#ec4899" name="Female Population" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'csv_dataset') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {results.cohort_breakdown && results.cohort_breakdown.length > 0 && (
            <div>
              <h4 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Age & Gender Distribution (from CSV)</h4>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.cohort_breakdown} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age_bracket" />
                    <YAxis />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="male" fill="#3b82f6" name="Male" />
                    <Bar dataKey="female" fill="#ec4899" name="Female" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {results.distribution_data && results.distribution_data.length > 0 && (
            <div>
              <h4 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Income Distribution Breakdown (from CSV)</h4>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={results.distribution_data}
                      dataKey="population"
                      nameKey="bracket"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      label={(entry) => `${entry.bracket} (${entry.percentage}%)`}
                    >
                      {results.distribution_data.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <p style={{ padding: '1rem', color: '#64748b' }}>No chart visualization data available.</p>;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Demographics Analytics & Simulation Workbench</h1>
      </header>

      {statusMsg && <div className="status-banner">{statusMsg}</div>}

      {!user ? (
        <div className="card">
          <h2>{isRegistering ? 'Create Account' : 'User Login'}</h2>
          <form onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <div className="form-group">
                <label>Username</label>
                <input
                  className="form-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary" type="submit">
              {isRegistering ? 'Sign Up' : 'Log In'}
            </button>
          </form>
          <p style={{ marginTop: '1rem' }}>
            {isRegistering ? 'Have an account?' : 'Need an account?'}{' '}
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setStatusMsg('');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isRegistering ? 'Log In' : 'Sign Up'}
            </button>
          </p>
        </div>
      ) : (
        <div>
          <div className="user-bar">
            <p>
              Logged in as: <strong>{user?.username}</strong>
            </p>
            <button className="btn-secondary" onClick={handleLogout}>
              Log Out
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              className={activeTab === 'sim' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('sim')}
            >
              Run Demographic Simulation
            </button>
            <button
              className={activeTab === 'csv' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('csv')}
            >
              Upload Survey CSV
            </button>
          </div>

          {activeTab === 'sim' ? (
            <div className="card">
              <h3>Configure Simulation Scenario</h3>
              <form onSubmit={handleSimulationSubmit}>
                <div className="form-group">
                  <label>Simulation Type</label>
                  <select
                    className="form-input"
                    value={simType}
                    onChange={(e) => setSimType(e.target.value)}
                  >
                    <option value="exponential_growth">
                      Exponential Growth Projection (Time-Series)
                    </option>
                    <option value="wealth_distribution">
                      Income & Wealth Distribution (Donut Breakdown)
                    </option>
                    <option value="age_gender_cohort">
                      Age & Gender Cohort Breakdown (Grouped Bars)
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Simulation Title</label>
                  <input
                    className="form-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. BC Aggressive Growth 2035"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Target Region / Subdivision</label>
                  <input
                    className="form-input"
                    type="text"
                    value={subdivisionName}
                    onChange={(e) => setSubdivisionName(e.target.value)}
                    required
                  />
                </div>

                {simType === 'exponential_growth' && (
                  <div className="form-grid-3">
                    <div className="form-group">
                      <label>Annual Growth Rate</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.001"
                        value={annualGrowthRate}
                        onChange={(e) => setAnnualGrowthRate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Horizon (Years)</label>
                      <input
                        className="form-input"
                        type="number"
                        value={projectionYears}
                        onChange={(e) => setProjectionYears(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {simType === 'wealth_distribution' && (
                  <div className="form-group">
                    <label>Income Measurement</label>
                    <select
                      className="form-input"
                      value={incomeMode}
                      onChange={(e) => setIncomeMode(e.target.value)}
                    >
                      <option value="household">Household Income</option>
                      <option value="individual">Individual Income</option>
                    </select>
                  </div>
                )}

                <button
                  className="btn-primary"
                  type="submit"
                  style={{ marginTop: '0.75rem' }}
                >
                  Run Scenario & Generate Chart
                </button>
              </form>
            </div>
          ) : (
            <div className="card">
              <h3>Upload Custom Demographic Dataset (CSV)</h3>
              <form onSubmit={handleCsvSubmit}>
                <div className="form-group">
                  <label>Dataset Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={csvTitle}
                    onChange={(e) => setCsvTitle(e.target.value)}
                    placeholder="e.g. Greater Victoria Survey 2026"
                  />
                </div>
                <div className="form-group">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    required
                  />
                </div>
                <button className="btn-primary" type="submit">
                  Process & Ingest CSV
                </button>
              </form>
            </div>
          )}

          {/* SIMULATION LIST WITH VISUAL JOIN SELECTION */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Saved Simulations & Visualizations</h3>
              <button
                className="btn-primary"
                style={{ backgroundColor: selectedForJoin.length === 2 ? '#7c3aed' : '#94a3b8' }}
                disabled={selectedForJoin.length !== 2}
                onClick={executeVisualJoin}
              >
                ⨝ Execute Visual Natural Join ({selectedForJoin.length}/2 Selected)
              </button>
            </div>

            {simulations.length === 0 ? (
              <p>No records found.</p>
            ) : (
              simulations.map((sim) => {
                const params =
                  typeof sim.parameters === 'string'
                    ? JSON.parse(sim.parameters)
                    : sim.parameters;
                const isChecked = selectedForJoin.includes(sim.simulation_id);

                return (
                  <div
                    key={sim.simulation_id}
                    className="sim-card"
                    style={{ border: isChecked ? '2px solid #7c3aed' : '1px solid #e2e8f0' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectForJoin(sim.simulation_id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div>
                          <h4 style={{ margin: 0 }}>{sim.title}</h4>
                          <div className="sim-meta">
                            Type: <strong>{params?.sim_type}</strong> | Region:{' '}
                            <strong>{params?.subdivision || 'Custom CSV'}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="sim-actions">
                        <button
                          className="btn-primary"
                          onClick={() => setActiveChartSim(sim)}
                        >
                          📊 View Single Chart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SINGLE GRAPH MODAL */}
      {activeChartSim && (
        <div className="modal-overlay" onClick={() => setActiveChartSim(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{activeChartSim.title}</h3>
              <button className="btn-secondary" onClick={() => setActiveChartSim(null)}>✕ Close</button>
            </div>
            {renderSimulationChart(activeChartSim)}
          </div>
        </div>
      )}

      {/* VISUAL NATURAL JOIN MODAL */}
      {activeJoinedVisual && (
        <div className="modal-overlay" onClick={() => setActiveJoinedVisual(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>{activeJoinedVisual.title}</h3>
                <small style={{ color: '#64748b' }}>Combined comparison rendering data merged across both scenario records</small>
              </div>
              <button className="btn-secondary" onClick={() => setActiveJoinedVisual(null)}>✕ Close</button>
            </div>

            {/* Time-Series Join Output */}
            {activeJoinedVisual.type === 'time_series_join' && (
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeJoinedVisual.data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Legend />
                    <Line type="monotone" dataKey="Census Baseline" stroke="#94a3b8" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey={activeJoinedVisual.simAName} stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey={activeJoinedVisual.simBName} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Cohort Breakdown Join Output */}
            {activeJoinedVisual.type === 'cohort_join' && (
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeJoinedVisual.data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age_bracket" />
                    <YAxis tickFormatter={(v) => `${(v / 1e3).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey={activeJoinedVisual.simAName} fill="#3b82f6" />
                    <Bar dataKey={activeJoinedVisual.simBName} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}