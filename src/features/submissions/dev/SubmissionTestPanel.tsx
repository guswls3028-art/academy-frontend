const handleUpload = async (file: File) => {
  const formData = new FormData();

  // ✅ backend contract 정확히 맞춤
  formData.append("enrollment_id", "1"); // 테스트용
  formData.append("target_type", "exam");
  formData.append("target_id", "1");
  formData.append("source", "omr_scan");
  formData.append("file", file);

  const submission = await createSubmission(formData);
  setSubmissionId(submission.id);
};
