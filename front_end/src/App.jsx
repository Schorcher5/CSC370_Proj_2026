import { useEffect, useState } from 'react';

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `request failed (${res.status})`);
  return body;
}

function AuthForms({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'register') {
        await api('/register', { method: 'POST', body: JSON.stringify(form) });
        setMode('login');
        return;
      }
      const { username } = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      onAuthed(username);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 320 }}>
      <h2>{mode === 'login' ? 'Log in' : 'Register'}</h2>
      {mode === 'register' && (
        <input
          placeholder="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
      )}
      <input
        placeholder="email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        placeholder="password"
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
      <p>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
        </button>
      </p>
    </form>
  );
}

function NewRecordForm({ reference, onSubmitted }) {
  const [subdivisionId, setSubdivisionId] = useState('');
  const [censusYear, setCensusYear] = useState('');
  const [totalPopulation, setTotalPopulation] = useState('');
  const [counts, setCounts] = useState({ age: {}, ethnicity: {}, education: {}, wealth: {} });
  const [error, setError] = useState(null);

  const dims = {
    age: { rows: reference.ageBrackets, idKey: 'age_bracket_id' },
    ethnicity: { rows: reference.ethnicities, idKey: 'ethnicity_id' },
    education: { rows: reference.educationLevels, idKey: 'education_level_id' },
    wealth: { rows: reference.wealthBrackets, idKey: 'wealth_bracket_id' },
  };

  function setCount(dim, id, value) {
    setCounts((c) => ({ ...c, [dim]: { ...c[dim], [id]: value } }));
  }

  function toBreakdownArray(dim) {
    const { idKey } = dims[dim];
    return Object.entries(counts[dim])
      .filter(([, v]) => v !== '')
      .map(([id, v]) => ({ id: Number(id), count: Number(v) }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = await api('/census-records', {
        method: 'POST',
        body: JSON.stringify({
          subdivision_id: Number(subdivisionId),
          census_year: Number(censusYear),
          total_population: Number(totalPopulation),
          age: toBreakdownArray('age'),
          ethnicity: toBreakdownArray('ethnicity'),
          education: toBreakdownArray('education'),
          wealth: toBreakdownArray('wealth'),
        }),
      });
      onSubmitted(body.census_record_id);
      setSubdivisionId('');
      setCensusYear('');
      setTotalPopulation('');
      setCounts({ age: {}, ethnicity: {}, education: {}, wealth: {} });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3>Submit a census record</h3>
      <label>
        Subdivision:{' '}
        <select value={subdivisionId} onChange={(e) => setSubdivisionId(e.target.value)} required>
          <option value="" disabled>select one</option>
          {reference.subdivisions.map((s) => (
            <option key={s.subdivision_id} value={s.subdivision_id}>{s.name}</option>
          ))}
        </select>
      </label>
      <br />
      <label>
        Year: <input type="number" value={censusYear} onChange={(e) => setCensusYear(e.target.value)} required />
      </label>
      <br />
      <label>
        Total population:{' '}
        <input type="number" value={totalPopulation} onChange={(e) => setTotalPopulation(e.target.value)} required />
      </label>

      {Object.entries(dims).map(([dim, { rows, idKey }]) => (
        <fieldset key={dim}>
          <legend>{dim}</legend>
          {rows.map((row) => (
            <label key={row[idKey]} style={{ display: 'inline-block', marginRight: 12 }}>
              {row.label}:{' '}
              <input
                type="number"
                style={{ width: 90 }}
                value={counts[dim][row[idKey]] ?? ''}
                onChange={(e) => setCount(dim, row[idKey], e.target.value)}
              />
            </label>
          ))}
        </fieldset>
      ))}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">Submit</button>
    </form>
  );
}

function Dashboard({ username, onLoggedOut }) {
  const [records, setRecords] = useState([]);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState(null);

  async function loadRecords() {
    try {
      setRecords(await api('/census-records'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadRecords();
    Promise.all([
      api('/reference/subdivisions'),
      api('/reference/age-brackets'),
      api('/reference/ethnicities'),
      api('/reference/education-levels'),
      api('/reference/wealth-brackets'),
    ])
      .then(([subdivisions, ageBrackets, ethnicities, educationLevels, wealthBrackets]) => {
        setReference({ subdivisions, ageBrackets, ethnicities, educationLevels, wealthBrackets });
      })
      .catch((err) => setError(err.message));
  }, []);

  async function logout() {
    await api('/logout', { method: 'POST' });
    onLoggedOut();
  }

  return (
    <div>
      <p>
        Logged in as <strong>{username}</strong>{' '}
        <button onClick={logout}>Log out</button>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h3>Your census records</h3>
      <ul>
        {records.map((r) => (
          <li key={r.census_record_id}>
            subdivision {r.subdivision_id} — {r.census_year} — population {r.total_population}
          </li>
        ))}
        {records.length === 0 && <li>none yet</li>}
      </ul>

      {reference && <NewRecordForm reference={reference} onSubmitted={loadRecords} />}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/me')
      .then((body) => setUsername(body.user.username))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <p>Loading...</p>;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '2rem auto' }}>
      <h1>Demographics App</h1>
      {username
        ? <Dashboard username={username} onLoggedOut={() => setUsername(null)} />
        : <AuthForms onAuthed={setUsername} />}
    </div>
  );
}
