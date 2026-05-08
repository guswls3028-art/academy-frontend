import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-single-reanalyze-trial-2026-05-05";
const API = "https://api.hakwonplus.com";

test("doc 321 problems meta dump", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  const H = { Authorization: `Bearer ${tok}`, "X-Tenant-Code": "tchul" };
  const r = await page.request.get(`${API}/api/v1/matchup/problems/?document_id=321`, {
    headers: H,
    timeout: 30_000,
  });
  expect(r.status()).toBe(200);
  const list = await r.json();
  fs.writeFileSync(
    `${SHOT_DIR}/05-doc321-meta-dump.json`,
    JSON.stringify(
      (list as Array<{ id: number; number: number; meta: unknown }>).slice(0, 5).map(
        (p) => ({ id: p.id, number: p.number, meta: p.meta }),
      ),
      null,
      2,
    ),
  );
  // manual 비율
  const manualCount = (list as Array<{ meta?: { manual?: boolean } }>).filter(
    (p) => p.meta?.manual === true,
  ).length;
  console.log(
    `total=${list.length} manual=${manualCount} ratio=${(manualCount / list.length).toFixed(2)}`,
  );
});
