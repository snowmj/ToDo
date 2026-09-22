import { useAuth } from '../lib/AuthProvider';

export function Login() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--paper)' }}>
      <div
        className="w-full max-w-sm rounded-lg border p-8 text-center"
        style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
      >
        <p className="label mb-2">DAILY ARC</p>
        <h1 className="font-display text-3xl mb-2">One place for everything on your plate.</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--ink-soft)' }}>
          Sign in with the Google account this is set up for.
        </p>
        <button
          onClick={() => void signInWithGoogle()}
          className="w-full rounded-full px-5 py-3 text-sm font-medium transition"
          style={{ background: 'var(--accent)', color: 'var(--paper)' }}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export function NotAllowed() {
  const { signOut, session } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--paper)' }}>
      <div
        className="w-full max-w-sm rounded-lg border p-8 text-center"
        style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
      >
        <h1 className="font-display text-2xl mb-3">This account isn't on the list</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-soft)' }}>
          Signed in as {session?.user.email}. Daily Arc is a single-user app — only the allowlisted
          account can use it.
        </p>
        <button
          onClick={() => void signOut()}
          className="rounded-full px-5 py-2 text-sm font-medium border"
          style={{ borderColor: 'var(--line)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
