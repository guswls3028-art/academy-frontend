import { expect, test } from "../fixtures/strictTest";
import {
  isTemplateVisibleInPicker,
  savedTemplatePickerPriority,
} from "../../src/app_admin/domains/messages/utils/templatePicker";
import { resolveManualAlimtalkTemplateType } from "../../src/app_admin/domains/messages/constants/alimtalkEnvelope";

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

  test("성적 화면에서 클리닉 문구를 재사용해도 성적 봉투를 유지한다", () => {
    expect(resolveManualAlimtalkTemplateType("grades", "clinic", "클리닉 안내 문구"))
      .toBe("score");
  });

  test("현재 화면에 봉투가 없을 때만 저장 문구 카테고리를 사용한다", () => {
    expect(resolveManualAlimtalkTemplateType("default", "clinic", "클리닉 안내 문구"))
      .toBe("clinic_info");
  });

  test("고정 결제 문구는 다른 화면의 봉투로 바꾸지 않는다", () => {
    expect(resolveManualAlimtalkTemplateType("attendance", "payment", "결제 안내"))
      .toBe("notice_payment");
  });
});
