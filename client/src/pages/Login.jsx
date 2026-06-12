import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.error || 'Inloggen mislukt. Controleer je gegevens.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-5xl">⚽</Link>
          <h1 className="text-3xl font-black text-white mt-3">
            Welkom terug
          </h1>
          <p className="text-gray-400 mt-1">Log in op je account</p>
        </div>

        <div className="card">
          {error && <div className="alert-error mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="block text-sm text-gray-400 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-pitch-900 border-t-transparent rounded-full animate-spin"></span>
                  Inloggen...
                </span>
              ) : 'Inloggen'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm text-gray-400">
          Nog geen account?{' '}
          <Link to="/register" className="text-grass-400 hover:text-grass-300 font-medium">
            Registreer gratis
          </Link>
        </p>

        <div className="mt-6 card bg-pitch-800/50 text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-1">Testaccounts:</p>
          <p>speler1@test.be / test1234</p>
          <p>admin@footballrivals.be / admin1234</p>
        </div>
      </div>
    </div>
  );
}
