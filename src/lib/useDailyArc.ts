import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Category, Completion, Task } from './types';

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

interface UndoEntry {
  label: string;
  run: () => Promise<void>;
}

const MAX_UNDO = 50;
const isReal = (c: Completion) => !c.id.startsWith('optimistic-');

export function useDailyArc() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const undoRef = useRef<UndoEntry[]>([]);
  const [, setUndoVersion] = useState(0);

  const pushUndo = useCallback((label: string, run: () => Promise<void>) => {
    undoRef.current = [...undoRef.current.slice(-(MAX_UNDO - 1)), { label, run }];
    setUndoVersion((v) => v + 1);
  }, []);

  const undo = useCallback(async () => {
    const entry = undoRef.current[undoRef.current.length - 1];
    if (!entry) return;
    undoRef.current = undoRef.current.slice(0, -1);
    setUndoVersion((v) => v + 1);
    await entry.run();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const [c, t, comp] = await Promise.all([
      supabase.from('dailyarc_categories').select('*').order('sort_order'),
      supabase.from('dailyarc_tasks').select('*').order('sort_order'),
      supabase.from('dailyarc_completions').select('*'),
    ]);
    if (c.error || t.error || comp.error) {
      setError(c.error?.message || t.error?.message || comp.error?.message || 'Failed to load');
    } else {
      setCategories(c.data as Category[]);
      setTasks(t.data as Task[]);
      setCompletions(comp.data as Completion[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const isDoneOn = useCallback(
    (taskId: string, date: string) =>
      completions.some((cc) => cc.task_id === taskId && cc.completed_on === date),
    [completions]
  );

  const toggleCompletion = useCallback(
    async (taskId: string, date: string = todayStr()) => {
      const existing = completions.find((cc) => cc.task_id === taskId && cc.completed_on === date);
      if (existing) {
        setCompletions((prev) => prev.filter((cc) => cc.id !== existing.id));
        const { error: delErr } = await supabase.from('dailyarc_completions').delete().eq('id', existing.id);
        if (delErr) {
          reload();
          return;
        }
        if (isReal(existing)) {
          pushUndo('Mark complete', async () => {
            setCompletions((prev) => [...prev, existing]);
            const { error: e } = await supabase.from('dailyarc_completions').insert(existing);
            if (e) reload();
          });
        }
      } else {
        const optimisticId = `optimistic-${taskId}-${date}`;
        setCompletions((prev) => [
          ...prev,
          { id: optimisticId, task_id: taskId, completed_on: date, created_at: new Date().toISOString() },
        ]);
        const { data, error: insErr } = await supabase
          .from('dailyarc_completions')
          .insert({ task_id: taskId, completed_on: date })
          .select()
          .single();
        if (insErr) {
          setCompletions((prev) => prev.filter((cc) => cc.id !== optimisticId));
        } else if (data) {
          const row = data as Completion;
          setCompletions((prev) => prev.map((cc) => (cc.id === optimisticId ? row : cc)));
          pushUndo('Mark incomplete', async () => {
            setCompletions((prev) => prev.filter((cc) => cc.id !== row.id));
            const { error: e } = await supabase.from('dailyarc_completions').delete().eq('id', row.id);
            if (e) reload();
          });
        }
      }
    },
    [completions, reload, pushUndo]
  );

  const removeTaskRows = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setCompletions((prev) => prev.filter((cc) => cc.task_id !== taskId));
    const { error: delErr } = await supabase.from('dailyarc_tasks').delete().eq('id', taskId);
    if (delErr) reload();
    return delErr;
  }, [reload]);

  const addTask = useCallback(async (categoryId: string, label: string) => {
    const sortOrder = tasks.filter((t) => t.category_id === categoryId).length;
    const { data, error: insErr } = await supabase
      .from('dailyarc_tasks')
      .insert({ category_id: categoryId, label, sort_order: sortOrder })
      .select()
      .single();
    if (!insErr && data) {
      const row = data as Task;
      setTasks((prev) => [...prev, row]);
      pushUndo('Add task', async () => {
        await removeTaskRows(row.id);
      });
    }
    return insErr;
  }, [tasks, pushUndo, removeTaskRows]);

  const setTaskActive = useCallback(async (taskId: string, active: boolean) => {
    const before = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, active } : t)));
    await supabase.from('dailyarc_tasks').update({ active }).eq('id', taskId);
    if (before && before.active !== active) {
      pushUndo(active ? 'Archive task' : 'Restore task', async () => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, active: before.active } : t)));
        await supabase.from('dailyarc_tasks').update({ active: before.active }).eq('id', taskId);
      });
    }
  }, [tasks, pushUndo]);

  const updateTaskLabel = useCallback(async (taskId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const before = tasks.find((t) => t.id === taskId);
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, label: trimmed } : t)));
    const { error: updErr } = await supabase.from('dailyarc_tasks').update({ label: trimmed }).eq('id', taskId);
    if (updErr) {
      setTasks(prevTasks);
      reload();
      return;
    }
    if (before) {
      pushUndo('Rename task', async () => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, label: before.label } : t)));
        await supabase.from('dailyarc_tasks').update({ label: before.label }).eq('id', taskId);
      });
    }
  }, [tasks, reload, pushUndo]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const taskCompletions = completions.filter((cc) => cc.task_id === taskId && isReal(cc));
    const delErr = await removeTaskRows(taskId);
    if (delErr) return;
    pushUndo('Delete task', async () => {
      setTasks((prev) => [...prev, task]);
      setCompletions((prev) => [...prev, ...taskCompletions]);
      const { error: e } = await supabase.from('dailyarc_tasks').insert(task);
      if (e) {
        reload();
        return;
      }
      if (taskCompletions.length) await supabase.from('dailyarc_completions').insert(taskCompletions);
    });
  }, [tasks, completions, removeTaskRows, pushUndo, reload]);

  const applyTaskOrder = useCallback(async (categoryId: string, orderedTaskIds: string[]) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.category_id !== categoryId) return t;
        const newOrder = orderedTaskIds.indexOf(t.id);
        return newOrder === -1 ? t : { ...t, sort_order: newOrder };
      })
    );
    const results = await Promise.all(
      orderedTaskIds.map((id, index) =>
        supabase.from('dailyarc_tasks').update({ sort_order: index }).eq('id', id)
      )
    );
    if (results.some((r) => r.error)) reload();
  }, [reload]);

  const reorderTasks = useCallback(async (categoryId: string, orderedTaskIds: string[]) => {
    const previousIds = tasks
      .filter((t) => t.category_id === categoryId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => t.id);
    await applyTaskOrder(categoryId, orderedTaskIds);
    pushUndo('Reorder tasks', () => applyTaskOrder(categoryId, previousIds));
  }, [tasks, applyTaskOrder, pushUndo]);

  const removeCategoryRow = useCallback(async (categoryId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    const { error: delErr } = await supabase.from('dailyarc_categories').delete().eq('id', categoryId);
    if (delErr) reload();
    return delErr;
  }, [reload]);

  const addCategory = useCallback(async (name: string, icon: string) => {
    const sortOrder = categories.length;
    const { data, error: insErr } = await supabase
      .from('dailyarc_categories')
      .insert({ name, icon, sort_order: sortOrder })
      .select()
      .single();
    if (!insErr && data) {
      const row = data as Category;
      setCategories((prev) => [...prev, row]);
      pushUndo('Add section', async () => {
        await removeCategoryRow(row.id);
      });
    }
    return insErr;
  }, [categories, pushUndo, removeCategoryRow]);

  const toggleTrackHistory = useCallback(async (categoryId: string, trackHistory: boolean) => {
    const before = categories.find((c) => c.id === categoryId);
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, track_history: trackHistory } : c))
    );
    await supabase.from('dailyarc_categories').update({ track_history: trackHistory }).eq('id', categoryId);
    if (before && before.track_history !== trackHistory) {
      pushUndo('Change history tracking', async () => {
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, track_history: before.track_history } : c))
        );
        await supabase.from('dailyarc_categories').update({ track_history: before.track_history }).eq('id', categoryId);
      });
    }
  }, [categories, pushUndo]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const catTasks = tasks.filter((t) => t.category_id === categoryId);
    const taskIds = catTasks.map((t) => t.id);
    const idSet = new Set(taskIds);
    const catCompletions = completions.filter((cc) => idSet.has(cc.task_id) && isReal(cc));

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setTasks((prev) => prev.filter((t) => t.category_id !== categoryId));
    setCompletions((prev) => prev.filter((cc) => !idSet.has(cc.task_id)));

    if (taskIds.length) {
      const r1 = await supabase.from('dailyarc_completions').delete().in('task_id', taskIds);
      const r2 = r1.error ? r1 : await supabase.from('dailyarc_tasks').delete().in('id', taskIds);
      if (r2.error) {
        reload();
        return;
      }
    }
    const { error: delErr } = await supabase.from('dailyarc_categories').delete().eq('id', categoryId);
    if (delErr) {
      reload();
      return;
    }

    pushUndo('Delete section', async () => {
      setCategories((prev) => [...prev, cat]);
      setTasks((prev) => [...prev, ...catTasks]);
      setCompletions((prev) => [...prev, ...catCompletions]);
      const { error: e1 } = await supabase.from('dailyarc_categories').insert(cat);
      if (e1) {
        reload();
        return;
      }
      if (catTasks.length) {
        const { error: e2 } = await supabase.from('dailyarc_tasks').insert(catTasks);
        if (e2) {
          reload();
          return;
        }
      }
      if (catCompletions.length) await supabase.from('dailyarc_completions').insert(catCompletions);
    });
  }, [categories, tasks, completions, reload, pushUndo]);

  const applyCategoryOrder = useCallback(async (orderedIds: string[]) => {
    setCategories((prev) =>
      prev.map((c) => {
        const i = orderedIds.indexOf(c.id);
        return i === -1 ? c : { ...c, sort_order: i };
      })
    );
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('dailyarc_categories').update({ sort_order: index }).eq('id', id)
      )
    );
    if (results.some((r) => r.error)) reload();
  }, [reload]);

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    const previousIds = [...categories].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
    await applyCategoryOrder(orderedIds);
    pushUndo('Move section', () => applyCategoryOrder(previousIds));
  }, [categories, applyCategoryOrder, pushUndo]);

  return {
    categories,
    tasks,
    completions,
    loading,
    error,
    reload,
    isDoneOn,
    toggleCompletion,
    addTask,
    setTaskActive,
    updateTaskLabel,
    deleteTask,
    reorderTasks,
    addCategory,
    toggleTrackHistory,
    deleteCategory,
    reorderCategories,
    undo,
    undoLabel: undoRef.current.length ? undoRef.current[undoRef.current.length - 1].label : null,
    todayStr,
  };
}
