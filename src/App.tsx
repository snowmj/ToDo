import { useEffect, useState } from 'react';
import { useAuth } from './lib/AuthProvider';
import { Login, NotAllowed } from './components/Login';
import { useDailyArc } from './lib/useDailyArc';
import { TodayView } from './components/TodayView';
import { HistoryView } from './components/HistoryView';
import { CategoriesView } from './components/CategoriesView';

type Tab = 'today' | 'history' | 'categories';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('dailyarc-theme') as 'light' | 'dark') ?? 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dailyarc-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return { theme, setTheme };
}

function AppShell() {
  const { signOut, session } = useAuth();
  const data = useDailyArc();
  const [tab, setTab] = useState<Tab>('today');
  const { theme, setTheme } = useTheme();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'history', label: 'History' },
    { id: 'categories', label: 'Categories' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--line)' }}
      >
        <div>
          <p className="label">DAILY ARC</p>
          <h1 className="font-display text-2xl">
            {tab === 'today' && 'Today'}
            {tab === 'history' && 'History'}
            {tab === 'categories' && 'Categories'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1 rounded-full border p-1" style={{ borderColor: 'var(--line)' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-full text-sm transition"
                style={{
                  background: tab === t.id ? 'var(--accent)' : 'transparent',
                  color: tab === t.id ? 'var(--paper)' : 'var(--ink-soft)',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="label"
            title="Toggle theme"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button onClick={() => void signOut()} className="label" title={session?.user.email}>
            sign out
          </button>
        </div>
      </header>

      <main className="px-6 py-8">
        {data.loading && (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Loading…
          </p>
        )}
        {data.error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {data.error}
          </p>
        )}
        {!data.loading && !data.error && (
          <>
            {tab === 'today' && <TodayView {...data} />}
            {tab === 'history' && <HistoryView {...data} />}
            {tab === 'categories' && <CategoriesView {...data} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading, allowed } = useAuth();

  if (loading || (session && allowed === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <p className="label">Loading…</p>
      </div>
    );
  }

  if (!session) return <Login />;
  if (!allowed) return <NotAllowed />;
  return <AppShell />;
}
