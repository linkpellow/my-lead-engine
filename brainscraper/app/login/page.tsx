'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if already authenticated
    fetch('/api/auth/login')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          const redirect = searchParams.get('redirect') || '/';
          router.push(redirect);
        }
      })
      .catch(() => {
        // Ignore errors, user needs to login
      });
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to the original page or home
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 space-y-8 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-orbitron">
            brainscraper.io
          </h1>
          <p className="text-gray-400">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
              placeholder="Enter password"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-white/10 border border-white/50 rounded-lg text-white text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-4 py-3 bg-white text-black hover:bg-gray-200 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

