// PATH: src/features/lectures/api/materials.ts
import api from "@/shared/api/axios";

const PREFIX = "/interactions";

/* =========================
 * TYPES
 * ========================= */
export interface MaterialCategory {
  id: number;
  lecture: number;
  name: string;
  order: number;
}

export interface Material {
  id: number;
  lecture: number;
  category: number | null;
  title: string;
  description: string;
  file: string | null;
  url: string | null;
  order: number;
  is_public: boolean;
  uploader_name?: string | null;
  created_at: string;
}

/* =========================
 * UTILS
 * ========================= */
function unwrap<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/* =========================
 * CATEGORY
 * ========================= */
export async function fetchMaterialCategories(
  lectureId: number
): Promise<MaterialCategory[]> {
  const res = await api.get(`${PREFIX}/material-categories/`, {
    params: { lecture: lectureId },
  });
  return unwrap<MaterialCategory>(res.data);
}

export async function createMaterialCategory(payload: {
  lecture: number;
  name: string;
}): Promise<MaterialCategory> {
  const res = await api.post(`${PREFIX}/material-categories/`, payload);
  return res.data;
}

/* =========================
 * MATERIAL
 * ========================= */
export async function fetchMaterials(params: {
  lecture: number;
  category?: number;
}): Promise<Material[]> {
  const res = await api.get(`${PREFIX}/materials/`, { params });
  return unwrap<Material>(res.data);
}

export async function createMaterial(formData: FormData): Promise<Material> {
  const res = await api.post(`${PREFIX}/materials/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
