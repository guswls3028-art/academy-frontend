// PATH: src/student/domains/profile/api/profile.ts
import api from "@/student/shared/api/studentApi";

/** 선생앱 학생·회원가입 모달과 동일 스펙 (내정보 표시·수정) */
export type MyProfile = {
  id: number;
  name: string;
  profile_photo_url: string | null;
  username?: string;
  ps_number?: string;
  parent_phone?: string;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  school_type?: "HIGH" | "MIDDLE";
  high_school?: string | null;
  middle_school?: string | null;
  origin_middle_school?: string | null;
  grade?: number | null;
  high_school_class?: string | null;
  major?: string | null;
  memo?: string | null;
  /** 학부모 읽기 전용 모드일 때 true */
  isParentReadOnly?: boolean;
  /** 학부모일 때 표시 이름 (예: "홍길동 학생 학부모님") */
  displayName?: string | null;
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

/** 이름·아이디·비밀번호·전화·성별·주소·학교정보 등 수정 (회원가입 모달 필드와 동일) */
export async function updateMyProfile(data: {
  name?: string;
  username?: string;
  current_password?: string;
  new_password?: string;
  phone?: string | null;
  parent_phone?: string;
  gender?: string | null;
  address?: string | null;
  school_type?: "HIGH" | "MIDDLE";
  high_school?: string | null;
  middle_school?: string | null;
  origin_middle_school?: string | null;
  grade?: number | null;
  high_school_class?: string | null;
  major?: string | null;
  memo?: string | null;
}): Promise<MyProfile> {
  const res = await api.patch<MyProfile>("/student/me/", data);
  return res.data;
}
