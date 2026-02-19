// PATH: src/student/domains/profile/api/profile.ts
import api from "@/student/shared/api/studentApi";

export type MyProfile = {
  id: number;
  name: string;
  profile_photo_url: string | null;
  /** 학생 번호(PS 번호) — 학원 학생 ID. 이름·로그인 아이디와 다름. */
  ps_number?: string;
  /** 로그인 아이디(표시용). 이름·PS번호와 다름. */
  username?: string;
  /** 부모 전화번호(필수 표시용). */
  parent_phone?: string;
};

export async function fetchMyProfile(): Promise<MyProfile> {
  const res = await api.get<MyProfile>("/student/me/");
  return res.data;
}

export async function updateMyProfilePhoto(file: File): Promise<MyProfile> {
  const form = new FormData();
  form.append("profile_photo", file);
  const res = await api.patch<MyProfile>("/student/me/", form);
  return res.data;
}

/** 이름·아이디·비밀번호 변경 (JSON PATCH) */
export async function updateMyProfile(data: {
  name?: string;
  username?: string;
  current_password?: string;
  new_password?: string;
}): Promise<MyProfile> {
  const res = await api.patch<MyProfile>("/student/me/", data);
  return res.data;
}
