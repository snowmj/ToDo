import { useState } from 'react';
import type { Category, Task } from '../lib/types';
import type { useDailyArc } from '../lib/useDailyArc';

export function TodayView(props: ReturnType<typeof useDailyArc>) {
  const { categories, tasks, isDoneOn, toggleCompletion, addTask, todayStr } = props;
  const today = todayStr();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const submitAdd = async (categoryId: string) => {
    const label = draft.trim();
    if (!label) return;
    setDraft('');
    setAddingTo(null);
    await addTask(categoryId, label);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((cat: Category) => {
        const catTasks = tasks
          .filter((t) => t.category_id === cat.id && t.active)
          .sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div
            key={cat.id}
            className="rounded-lg border p-4"
            style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg flex items-center gap-2">
                <span>{cat.icon}</span>
                {cat.name}
              </h2>
              {cat.track_history && (
                <span className="label" style={{ color: 'var(--accent)' }}>
                  tracked
                </span>
              )}
            </div>
            <ul className="space-y-1.5">
              {catTasks.map((task: Task) => {
                const done = isDoneOn(task.id, today);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => void toggleCompletion(task.id, today)}
                      className="w-full flex items-start gap-2 text-left text-sm rounded px-2 py-1.5 -mx-2 transition"
                      style={{
                        color: done ? 'var(--ink-soft)' : 'var(--ink)',
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      <span
                        className="mt-0.5 flex-none w-4 h-4 rounded-full border flex items-center justify-center"
                        style={{
                          borderColor: done ? 'var(--accent)' : 'var(--line)',
                          background: done ? 'var(--accent)' : 'transparent',
                        }}
                      >
                        {done && (
                          <span style={{ color: 'var(--paper)', fontSize: 10, lineHeight: 1 }}>✓</span>
                        )}
                      </span>
                      {task.label}
                    </button>
                  </li>
                );
              })}
              {catTasks.length === 0 && (
                <li className="text-sm italic" style={{ color: 'var(--ink-soft)' }}>
                  Nothing here yet
                </li>
              )}
            </ul>

            {addingTo === cat.id ? (
              <div className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitAdd(cat.id);
                    if (e.key === 'Escape') setAddingTo(null);
                  }}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
                  placeholder="New task…"
                />
                <button
                  onClick={() => void submitAdd(cat.id)}
                  className="text-sm px-2 rounded"
                  style={{ color: 'var(--accent)' }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingTo(cat.id)}
                className="mt-3 label"
                style={{ color: 'var(--accent)' }}
              >
                + add task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
