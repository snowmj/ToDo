import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Category, Completion, Task } from './types';

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export function useDailyArc() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (delErr) reload();
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
          setCompletions((prev) => prev.map((cc) => (cc.id === optimisticId ? (data as Completion) : cc)));
        }
      }
    },
    [completions, reload]
  );

  const addTask = useCallback(async (categoryId: string, label: string) => {
    const sortOrder = tasks.filter((t) => t.category_id === categoryId).length;
    const { data, error: insErr } = await supabase
      .from('dailyarc_tasks')
      .insert({ category_id: categoryId, label, sort_order: sortOrder })
      .select()
      .single();
    if (!insErr && data) setTasks((prev) => [...prev, data as Task]);
    return insErr;
  }, [tasks]);

  const setTaskActive = useCallback(async (taskId: string, active: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, active } : t)));
    await supabase.from('dailyarc_tasks').update({ active }).eq('id', taskId);
  }, []);

  const updateTaskLabel = useCallback(async (taskId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, label: trimmed } : t)));
    const { error: updErr } = await supabase.from('dailyarc_tasks').update({ label: trimmed }).eq('id', taskId);
    if (updErr) {
      setTasks(prevTasks);
      reload();
    }
  }, [tasks, reload]);

  const deleteTask = useCallback(async (taskId: string) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setCompletions((prev) => prev.filter((cc) => cc.task_id !== taskId));
    const { error: delErr } = await supabase.from('dailyarc_tasks').delete().eq('id', taskId);
    if (delErr) {
      setTasks(prevTasks);
      reload();
    }
  }, [tasks, reload]);

  const reorderTasks = useCallback(async (categoryId: string, orderedTaskIds: string[]) => {
    const prevTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.category_id !== categoryId) return t;
        const newOrder = orderedTaskIds.indexOf(t.id);
        return newOrder === -1 ? t : { ...t, sort_order: newOrder };
      })
    );
    try {
      await Promise.all(
        orderedTaskIds.map((id, index) =>
          supabase.from('dailyarc_tasks').update({ sort_order: index }).eq('id', id)
        )
      );
    } catch {
      setTasks(prevTasks);
      reload();
    }
  }, [tasks, reload]);

  const addCategory = useCallback(async (name: string, icon: string) => {
    const sortOrder = categories.length;
    const { data, error: insErr } = await supabase
      .from('dailyarc_categories')
      .insert({ name, icon, sort_order: sortOrder })
      .select()
      .single();
    if (!insErr && data) setCategories((prev) => [...prev, data as Category]);
    return insErr;
  }, [categories]);

  const toggleTrackHistory = useCallback(async (categoryId: string, trackHistory: boolean) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, track_history: trackHistory } : c))
    );
    await supabase.from('dailyarc_categories').update({ track_history: trackHistory }).eq('id', categoryId);
  }, []);

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
    todayStr,
  };
}
