import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      return setError('Gebruikersnaam: alleen letters, cijfers en _');
    }
    if (form.password.length < 6) {
      return setError('Wachtwoord minimaal 6 tekens');
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/lobby');
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'Registratie mislukt';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-5xl">⚽</Link>
          <h1 className="text-3xl font-black text-white mt-3">Account aanmaken</h1>
          <p className="text-gray-400 mt-1">Gratis, in enkele seconden</p>
        </div>

        <div className="card">
          {error && <div className="alert-error mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Gebruikersnaam <span className="text-gray-600">(3-20 tekens, a-z 0-9 _)</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="JouwNaam123"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                minLength={3} maxLength={20}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">E-mailadres</label>
              <input
                type="email"
                className="input-field"
                placeholder="jouw@email.be"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Wachtwoord <span className="text-gray-600">(min. 6 tekens)</span>
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-pitch-900 border-t-transparent rounded-full animate-spin"></span>
                  Account aanmaken...
                </span>
              ) : '🚀 Account aanmaken'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm text-gray-400">
          Al een account?{' '}
          <Link to="/login" className="text-grass-400 hover:text-grass-300 font-medium">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
