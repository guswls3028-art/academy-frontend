// PATH: src/student/domains/profile/api/profile.ts
import api from "@/student/shared/api/studentApi";

/** 선생앱 학생 필드 스펙과 동일 (내정보 표시·수정) */
export type MyProfile = {
  id: number;
  name: string;
  profile_photo_url: string | null;
  /** 로그인 아이디(표시·변경용). 선생앱 "아이디"와 동일 */
  username?: string;
  /** 학원 내부 학생 번호. UI에는 노출만(선생앱과 동일 스펙) */
  ps_number?: string;
  /** 학부모 전화번호 */
  parent_phone?: string;
  /** 학생(본인) 전화번호 */
  phone?: string | null;
  /** 성별 M/F */
  gender?: string | null;
  /** 주소 */
  address?: string | null;
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

/** 이름·아이디·비밀번호·전화·성별·주소 등 수정 (선생앱 학생 필드 스펙과 동일) */
export async function updateMyProfile(data: {
  name?: string;
  username?: string;
  current_password?: string;
  new_password?: string;
  phone?: string | null;
  parent_phone?: string;
  gender?: string | null;
  address?: string | null;
}): Promise<MyProfile> {
  const res = await api.patch<MyProfile>("/student/me/", data);
  return res.data;
}
