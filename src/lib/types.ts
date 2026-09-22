export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  track_history: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  category_id: string;
  label: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Completion {
  id: string;
  task_id: string;
  completed_on: string; // YYYY-MM-DD
  created_at: string;
}
