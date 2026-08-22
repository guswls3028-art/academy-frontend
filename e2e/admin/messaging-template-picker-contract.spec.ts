import { expect, test } from "../fixtures/strictTest";
import {
  isTemplateVisibleInPicker,
  savedTemplatePickerPriority,
} from "../../src/app_admin/domains/messages/utils/templatePicker";

const savedWebsiteNotice = {
  category: "default" as const,
  is_system: false,
  is_user_default: false,
  name: "홈페이지 변경 안내",
};

test.describe("저장 알림톡 문구 재사용 계약", () => {
  test("default로 저장한 홈페이지 공지를 수업·운영 공지에서 불러온다", () => {
    expect(isTemplateVisibleInPicker(savedWebsiteNotice, "attendance", false)).toBeTruthy();
  });

  test("선택한 발송 유형 문구를 먼저, default 공지를 다음에 보여준다", () => {
    const attendance = {
      ...savedWebsiteNotice,
      category: "attendance" as const,
      name: "출석 안내",
    };
    expect(savedTemplatePickerPriority(attendance, "attendance"))
      .toBeLessThan(savedTemplatePickerPriority(savedWebsiteNotice, "attendance"));
  });

  test("계정용 signup 문구는 일반 수동 발송 목록에 섞지 않는다", () => {
    expect(isTemplateVisibleInPicker({
      ...savedWebsiteNotice,
      category: "signup",
    }, "attendance", false)).toBeFalsy();
  });
});
