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
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager';
  must_change_password: boolean;
}

export const MANAGERS = ['Cos', 'Brett', 'Kurt', 'Richard'] as const;
export type Manager = typeof MANAGERS[number];
