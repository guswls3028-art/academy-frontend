/**
 * R2 인벤토리 저장 경로·파일명 SSOT
 * tenants / {tenant_id} / {student_ps} / inventory / {폴더트리} / {파일명}
 *
 * - DB 메타데이터는 R2 업로드 성공 후에만 생성. R2 실패 시 롤백/에러 반환.
 * - 파일명 충돌 방지: 원본명 뒤에 타임스탬프(또는 짧은 해시) 부여.
 */

/**
 * R2 객체 키 생성.
 * @param tenantId - 태넌트 ID
 * @param studentPs - 학생 PS 번호
 * @param folderPath - 인벤토리 내 폴더 경로 (빈 문자열 = 루트). 예: "1학기/중간"
 * @param originalFileName - 원본 파일명 (예: 성적표.jpg)
 * @returns R2 key. 예: tenants/t1/12345/inventory/1학기/중간/성적표_240214_abc.jpg
 */
export function getInventoryR2Key(
  tenantId: string,
  studentPs: string,
  folderPath: string,
  originalFileName: string
): string {
  const safeName = safeInventoryFileName(originalFileName);
  const prefix = `tenants/${tenantId}/${studentPs}/inventory`;
  const path = folderPath ? `${prefix}/${folderPath}/${safeName}` : `${prefix}/${safeName}`;
  return path;
}

/**
 * 같은 폴더 내 이름 충돌 방지를 위해 원본 파일명에 타임스탬프(및 짧은 해시) 부여.
 * 예: 성적표.jpg → 성적표_240214_a1b2.jpg
 */
export function safeInventoryFileName(originalFileName: string): string {
  const lastDot = originalFileName.lastIndexOf(".");
  const base = lastDot >= 0 ? originalFileName.slice(0, lastDot) : originalFileName;
  const ext = lastDot >= 0 ? originalFileName.slice(lastDot) : "";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const hash = Math.random().toString(36).slice(2, 6);
  const safe = `${base}_${stamp}_${hash}${ext}`;
  return safe;
}

/**
 * 폴더 배열을 R2 경로 문자열로 변환.
 * [{ name: "1학기" }, { name: "중간" }] → "1학기/중간"
 */
export function folderPathFromIds(
  folders: { id: string; name: string; parentId: string | null }[],
  folderId: string | null
): string {
  if (!folderId) return "";
  const path: string[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const folder = folders.find((f) => f.id === currentId);
    if (!folder) break;
    path.unshift(folder.name);
    currentId = folder.parentId;
  }
  return path.join("/");
}
