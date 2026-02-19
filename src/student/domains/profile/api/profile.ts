// PATH: src/student/domains/profile/api/profile.ts
import api from "@/student/shared/api/studentApi";

export type MyProfile = {
  id: number;
  name: string;
  profile_photo_url: string | null;
};

export async function fetchMyProfile(): Promise<MyProfile> {
  const res = await api.get<MyProfile>("/student/me/");
  return res.data;
}

export async function updateMyProfilePhoto(file: File): Promise<MyProfile> {
  const form = new FormData();
  form.append("profile_photo", file);
  const res = await api.patch<MyProfile>("/student/me/", form, {
    headers: { "Content-Type": undefined } as Record<string, unknown>,
  });
  return res.data;
}
