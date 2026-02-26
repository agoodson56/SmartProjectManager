export interface Project {
  id: number;
  name: string;
  manager: string;
  lead_name: string;
  est_labor_hours: number;
  used_labor_hours: number;
  est_material_cost: number;
  used_material_cost: number;
  est_odc: number;
  used_odc: number;
  completed_at: string | null;
  deadline: string | null;
  updated_at: string;
  mat_labor_est: number;
  mat_labor_actual: number;
  mat_count: number;
  addon_count: number;
  materials?: Material[];
}

export interface Material {
  id: number;
  project_id: number;
  name: string;
  quantity: number;
  labor_hours_per_unit: number;
  unit_cost: number;
  quantity_used: number;
  actual_labor_hours: number;
  is_addon: number;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'superintendent';
  must_change_password: boolean;
}

export const MANAGERS = ['Cos', 'Brett', 'Kurt', 'Richard', 'Daniel', 'Kyle', 'Eric'] as const;
export type Manager = typeof MANAGERS[number];
