import type { Category } from '../lib/types';
import type { useDailyArc } from '../lib/useDailyArc';

function lastNDays(n: number) {
  const days: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dt = new Date(d);
    dt.setDate(d.getDate() - i);
    const tz = dt.getTimezoneOffset();
    const local = new Date(dt.getTime() - tz * 60000);
    days.push(local.toISOString().slice(0, 10));
  }
  return days.reverse();
}

export function HistoryView(props: ReturnType<typeof useDailyArc>) {
  const { categories, tasks, completions } = props;
  const tracked = categories.filter((c) => c.track_history);
  const days = lastNDays(35);

  const dotColor = (cat: Category, date: string) => {
    const catTasks = tasks.filter((t) => t.category_id === cat.id && t.active);
    if (catTasks.length === 0) return 'transparent';
    const doneCount = catTasks.filter((t) =>
      completions.some((cc) => cc.task_id === t.id && cc.completed_on === date)
    ).length;
    const ratio = doneCount / catTasks.length;
    if (ratio === 0) return 'var(--danger)';
    if (ratio < 1) return 'var(--warn)';
    return 'var(--ok)';
  };

  if (tracked.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
        No categories are set to track history yet. Toggle "track history" on a category to see its
        pattern here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {tracked.map((cat) => (
        <div
          key={cat.id}
          className="rounded-lg border p-4"
          style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
        >
          <h2 className="font-display text-lg mb-3 flex items-center gap-2">
            <span>{cat.icon}</span>
            {cat.name}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {days.map((date) => (
              <span
                key={date}
                title={date}
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ background: dotColor(cat, date), border: '1px solid var(--line)' }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
