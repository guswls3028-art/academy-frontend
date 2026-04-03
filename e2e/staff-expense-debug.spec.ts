import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const API = "https://api.hakwonplus.com";

test("비용 등록 500 디버그", async ({ page }) => {
  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));

  // 직원 목록에서 아무나 가져오기
  const staffResp = await page.request.get(`${API}/api/v1/staffs/`, {
    headers: { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}` },
  });
  const staffData = await staffResp.json();
  const staff = (staffData.results || [])[0];
  if (!staff) { console.log("No staff"); return; }
  console.log("Staff:", staff.id, staff.name);

  // 비용 등록 시도
  const resp = await page.request.post(`${API}/api/v1/staffs/expense-records/`, {
    headers: { "X-Tenant-Code": "hakwonplus", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    data: { staff: staff.id, date: "2026-04-01", title: "debug-test", amount: 1000, memo: "" },
  });
  console.log("Status:", resp.status());
  const body = await resp.text();
  console.log("Body:", body.slice(0, 500));
});
