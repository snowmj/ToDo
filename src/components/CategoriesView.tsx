import { useState } from 'react';
import type { useDailyArc } from '../lib/useDailyArc';

export function CategoriesView(props: ReturnType<typeof useDailyArc>) {
  const { categories, addCategory, toggleTrackHistory } = props;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    await addCategory(trimmed, icon);
  };

  return (
    <div className="max-w-lg">
      <ul className="space-y-2 mb-6">
        {[...categories]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
              style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
            >
              <span className="flex items-center gap-2 text-sm">
                <span>{cat.icon}</span>
                {cat.name}
              </span>
              <label className="flex items-center gap-2 label cursor-pointer">
                <input
                  type="checkbox"
                  checked={cat.track_history}
                  onChange={(e) => void toggleTrackHistory(cat.id, e.target.checked)}
                />
                track history
              </label>
            </li>
          ))}
      </ul>

      <div
        className="rounded-lg border p-4 flex gap-2"
        style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
      >
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-12 rounded border text-center py-1"
          style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="New category name…"
          className="flex-1 rounded border px-3 py-1 text-sm"
          style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
        />
        <button onClick={() => void submit()} className="text-sm px-3 rounded" style={{ color: 'var(--accent)' }}>
          Add
        </button>
      </div>
    </div>
  );
}
