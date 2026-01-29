import axios from "@/shared/api/axios";

export const fetchStudentDetail = async (id: string | number) => {
  const res = await axios.get(`/students/${id}/`);
  return res.data;
};

export const fetchTags = async () => {
  const res = await axios.get(`/tags/`);
  return res.data;
};

export const addTag = async (id: number, tagId: number) => {
  const res = await axios.post(`/students/${id}/add_tag/`, {
    tag_id: tagId,
  });
  return res.data;
};

export const removeTag = async (id: number, tagId: number) => {
  const res = await axios.post(`/students/${id}/remove_tag/`, {
    tag_id: tagId,
  });
  return res.data;
};
