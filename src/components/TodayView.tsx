import { useState } from 'react';
import type { Category, Task } from '../lib/types';
import type { useDailyArc } from '../lib/useDailyArc';

function firstGrapheme(text: string): string {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    for (const part of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) return part.segment;
  }
  return Array.from(text)[0] ?? '';
}

export function TodayView(props: ReturnType<typeof useDailyArc>) {
  const { categories, tasks, isDoneOn, toggleCompletion, addTask, deleteTask, updateTaskLabel, reorderTasks, deleteCategory, reorderCategories, updateCategory, todayStr } = props;
  const today = todayStr();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<{ id: string; field: 'icon' | 'name' } | null>(null);
  const [catNameDraft, setCatNameDraft] = useState('');
  const [catIconDraft, setCatIconDraft] = useState('');

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditDraft(task.label);
  };

  const commitEdit = async (taskId: string) => {
    const label = editDraft.trim();
    setEditingTaskId(null);
    if (!label) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && label !== task.label) await updateTaskLabel(taskId, label);
  };

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const startEditingCat = (cat: Category, field: 'icon' | 'name') => {
    setEditingCat({ id: cat.id, field });
    setCatNameDraft(cat.name);
    setCatIconDraft(cat.icon ?? '');
  };

  const commitCatEdit = (cat: Category) => {
    setEditingCat(null);
    const name = catNameDraft.trim();
    const iconRaw = catIconDraft.trim();
    const icon = iconRaw ? firstGrapheme(iconRaw) : null;
    const patch: { name?: string; icon?: string | null } = {};
    if (name && name !== cat.name) patch.name = name;
    if (icon !== (cat.icon ?? null)) patch.icon = icon;
    if (Object.keys(patch).length) void updateCategory(cat.id, patch);
  };

  const moveCategory = (categoryId: string, delta: -1 | 1) => {
    const ids = sorted.map((c) => c.id);
    const from = ids.indexOf(categoryId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void reorderCategories(ids);
  };

  const submitAdd = async (categoryId: string) => {
    const label = draft.trim();
    if (!label) return;
    setDraft('');
    setAddingTo(null);
    await addTask(categoryId, label);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((cat: Category, catIndex: number) => {
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
              {editingCat?.id === cat.id ? (
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 mr-2"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitCatEdit(cat);
                  }}
                >
                  <input
                    autoFocus={editingCat.field === 'icon'}
                    value={catIconDraft}
                    onChange={(e) => setCatIconDraft(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingCat(null);
                    }}
                    className="flex-none text-center rounded border py-0.5 text-lg"
                    style={{ width: 44, borderColor: 'var(--accent)', background: 'var(--paper)', color: 'var(--ink)' }}
                    placeholder="🙂"
                    aria-label="Section icon"
                  />
                  <input
                    autoFocus={editingCat.field === 'name'}
                    value={catNameDraft}
                    onChange={(e) => setCatNameDraft(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingCat(null);
                    }}
                    className="flex-1 min-w-0 font-display text-lg rounded border px-1 py-0.5"
                    style={{ borderColor: 'var(--accent)', background: 'var(--paper)', color: 'var(--ink)' }}
                    aria-label="Section name"
                  />
                </div>
              ) : (
                <h2 className="font-display text-lg flex items-center gap-2">
                  <span
                    onClick={() => startEditingCat(cat, 'icon')}
                    className="cursor-pointer rounded"
                    title="Click to change icon"
                  >
                    {cat.icon || '＋'}
                  </span>
                  <span
                    onClick={() => startEditingCat(cat, 'name')}
                    className="cursor-text rounded"
                    title="Click to rename"
                  >
                    {cat.name}
                  </span>
                </h2>
              )}
              <div className="flex items-center gap-2">
                {cat.track_history && (
                  <span className="label" style={{ color: 'var(--accent)' }}>
                    tracked
                  </span>
                )}
                <button
                  onClick={() => setSettingsFor((prev) => (prev === cat.id ? null : cat.id))}
                  className="flex-none rounded"
                  style={{
                    color: settingsFor === cat.id ? 'var(--accent)' : 'var(--ink-soft)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '4px 6px',
                  }}
                  title="Section settings"
                  aria-label={`Settings for ${cat.name}`}
                  aria-expanded={settingsFor === cat.id}
                >
                  ⚙
                </button>
              </div>
            </div>
            {settingsFor === cat.id && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
              >
                <button
                  onClick={() => moveCategory(cat.id, -1)}
                  disabled={catIndex === 0}
                  className="rounded px-2 py-0.5 border"
                  style={{ borderColor: 'var(--line)', opacity: catIndex === 0 ? 0.4 : 1 }}
                  title="Move section earlier"
                >
                  ← Move
                </button>
                <button
                  onClick={() => moveCategory(cat.id, 1)}
                  disabled={catIndex === sorted.length - 1}
                  className="rounded px-2 py-0.5 border"
                  style={{ borderColor: 'var(--line)', opacity: catIndex === sorted.length - 1 ? 0.4 : 1 }}
                  title="Move section later"
                >
                  Move →
                </button>
                <button
                  onClick={() => {
                    setSettingsFor(null);
                    void deleteCategory(cat.id);
                  }}
                  className="ml-auto rounded px-2 py-0.5 border"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  title="Delete section"
                >
                  Delete section
                </button>
              </div>
            )}
            <ul className="space-y-1.5">
              {catTasks.map((task: Task) => {
                const done = isDoneOn(task.id, today);
                const isDragOver = dragOverTaskId === task.id && dragTaskId !== task.id;
                return (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      setDragTaskId(task.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragTaskId(null);
                      setDragOverTaskId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragTaskId && dragTaskId !== task.id) setDragOverTaskId(task.id);
                    }}
                    onDragLeave={() => {
                      setDragOverTaskId((prev) => (prev === task.id ? null : prev));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = dragTaskId;
                      setDragTaskId(null);
                      setDragOverTaskId(null);
                      if (!draggedId || draggedId === task.id) return;
                      const ids = catTasks.map((t) => t.id);
                      const from = ids.indexOf(draggedId);
                      const to = ids.indexOf(task.id);
                      if (from === -1 || to === -1) return;
                      ids.splice(to, 0, ids.splice(from, 1)[0]);
                      void reorderTasks(cat.id, ids);
                    }}
                    className="flex items-center gap-1 rounded -mx-2 px-2 transition"
                    style={{
                      background: isDragOver ? 'var(--paper)' : 'transparent',
                      opacity: dragTaskId === task.id ? 0.4 : 1,
                      borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    <span
                      className="flex-none cursor-grab select-none touch-none"
                      style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1, padding: '4px 2px' }}
                      title="Drag to reorder"
                    >
                      ⠿
                    </span>
                    <button
                      onClick={() => void toggleCompletion(task.id, today)}
                      className="flex-none mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: done ? 'var(--accent)' : 'var(--line)',
                        background: done ? 'var(--accent)' : 'transparent',
                      }}
                      title="Mark complete"
                      aria-label={done ? `Mark ${task.label} incomplete` : `Mark ${task.label} complete`}
                    >
                      {done && (
                        <span style={{ color: 'var(--paper)', fontSize: 10, lineHeight: 1 }}>✓</span>
                      )}
                    </button>
                    {editingTaskId === task.id ? (
                      <input
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={() => void commitEdit(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEditingTaskId(null);
                          }
                        }}
                        className="flex-1 text-sm rounded py-1.5 px-1 border"
                        style={{ borderColor: 'var(--accent)', background: 'var(--paper)', color: 'var(--ink)' }}
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(task)}
                        className="flex-1 text-left text-sm rounded py-1.5 cursor-text"
                        style={{
                          color: done ? 'var(--ink-soft)' : 'var(--ink)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {task.label}
                      </span>
                    )}
                    <button
                      onClick={() => void deleteTask(task.id)}
                      className="flex-none rounded"
                      style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1, padding: '4px 6px' }}
                      title="Delete task"
                      aria-label={`Delete ${task.label}`}
                    >
                      ✕
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
