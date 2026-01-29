// src/features/lectures/api/ddays.ts
/**
 * ⚠️ D-DAY API
 * - 현재 backend 미구현
 * - 프론트 UI 유지용 stub
 */

export interface Dday {
  id: number;
  lecture: number;
  title: string;
  date: string;
  created_at: string;
}

export async function fetchDdays(_: number): Promise<Dday[]> {
  return [];
}

export async function createDday(_: {
  lecture: number;
  title: string;
  date: string;
}): Promise<Dday> {
  throw new Error("D-Day API not implemented");
}

export async function deleteDday(_: number): Promise<void> {
  throw new Error("D-Day API not implemented");
}
