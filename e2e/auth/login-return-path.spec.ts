import { test, expect } from "../fixtures/strictTest";
import { getSafeInternalNextPath } from "../../src/auth/utils/loginReturnPath";

const ORIGIN = "https://hakwonplus.com";

test.describe("로그인 후 복귀 경로 보안", () => {
  test("같은 출처의 경로·검색·해시를 보존한다", () => {
    expect(getSafeInternalNextPath("/admin/students?tab=active#list", ORIGIN))
      .toBe("/admin/students?tab=active#list");
  });

  test("외부 URL과 프로토콜 상대 URL을 차단한다", () => {
    expect(getSafeInternalNextPath("https://evil.example/phish", ORIGIN)).toBeNull();
    expect(getSafeInternalNextPath("//evil.example/phish", ORIGIN)).toBeNull();
    expect(getSafeInternalNextPath("/\\evil.example/phish", ORIGIN)).toBeNull();
  });

  test("로그인 루프로 되돌아가는 경로를 차단한다", () => {
    expect(getSafeInternalNextPath("/login", ORIGIN)).toBeNull();
    expect(getSafeInternalNextPath("/login/hakwonplus?next=%2Fadmin", ORIGIN)).toBeNull();
  });
});
