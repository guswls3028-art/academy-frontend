import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const origin = "https://demo.hakwonplus.com";
const revision = process.env.EXPECT_REVISION?.split("/").pop();
assert.ok(["r22", "r23"].includes(revision), "Expected release must be r22 or r23");
const identity = async () => {
  const response = await fetch(origin + "/version.json", {redirect:"error", cache:"no-store"});
  assert.equal(response.status, 200, "public revision HTTP status");
  const meta = await response.json();
  assert.equal(meta.name, "dawon-learning-room");
  assert.equal(meta.productionApi, false);
  console.log("Public readback:", meta.version, "bundle:", meta.bundleVersion);
  assert.equal(meta.version.split("-").at(-1), revision, "Unexpected public release");
  return meta.version;
};

const roles = [
  {role:"admin", login:"관리자 데모 로그인", destination:/\/workspace/},
  {role:"teacher", login:"선생님 데모 로그인", destination:/\/workspace/},
  {role:"student", view:"clinic", login:"학생 데모로 클리닉 신청", destination:/\/student\/clinic/},
  {role:"guardian", view:"counsel", login:"학부모 데모로 상담 신청", destination:/\/student\/community/},
];
const authPaths = new Set(["/api/v1/students/demo-session/", "/api/v1/token/refresh/"]);
const version = await identity();
const browser = await chromium.launch();
let step = "start", failed = 0;
for (const width of [1366,390]) {
  for (const spec of roles) {
    const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
    await context.route("**/*", async route => {
      const req=route.request(), url=new URL(req.url());
      const safeRead = ["GET","HEAD","OPTIONS"].includes(req.method());
      const session = req.method()==="POST" && authPaths.has(url.pathname);
      if(url.origin !== origin || (!safeRead && !session)) return route.abort();
      await route.continue();
    });
    try {
      const page=await context.newPage();
      page.setDefaultTimeout(15000);
      step="login entry";
      await page.goto(origin+"/login/dawon?"+new URLSearchParams({demo:spec.role,...(spec.view?{view:spec.view}:{})}));
      const button=page.getByRole("button",{name:spec.login,exact:true});
      await button.waitFor();
      step="demo session exchange";
      const [session]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/students/demo-session/" && r.request().method()==="POST"),button.click()]);
      assert.equal(session.status(),200,"Demo-session HTTP "+session.status());
      step="authenticated destination";
      await page.waitForURL(spec.destination);
      if(spec.role==="admin"){
        step="cohort detail";
        await page.getByRole("combobox",{name:"반 선택",exact:true}).selectOption({label:"고1 HYPER 연합반"});
        const detail=page.locator("details").filter({has:page.locator("summary").filter({hasText:"HYPER 방학 수학Ⅱ"})});
        await detail.locator("summary").click();
        await detail.getByRole("button",{name:"시험 결과",exact:true}).click();
        if(revision==="r23"){
          step="exam dashboard and student report";
          await detail.getByRole("link").first().click();
          const roster=page.getByRole("region",{name:"학생별 시험 결과"});
          await roster.getByRole("link").first().click();
          await page.getByRole("heading",{name:"시험 성적 추이",exact:true}).waitFor();
          await page.getByRole("link",{name:"시험 결과로"}).click();
          await roster.waitFor();
        }else await expect(detail).toContainText("상위 평균 비교 예시 시험");
      }else if(spec.role==="teacher"){
        step="assigned class dashboard";
        await page.getByText("고1 HYPER 연합반",{exact:false}).first().waitFor();
      }else if(spec.role==="student"){
        step="clinic calendar";
        await page.getByRole("region",{name:"클리닉 날짜 선택"}).waitFor();
      }else{
        step="child counselling";
        await page.getByRole("button",{name:"상담 신청하기",exact:true}).waitFor();
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Viewport overflow");
      console.log("PASS",spec.role,width,step);
    }catch(error){
      failed++;
      console.error("FAIL",spec.role,width,step,error.name, /(HTTP \d{3})/.exec(error.message)?.[0] || "");
    }finally{await context.close();}
  }
}
await browser.close();
assert.equal(await identity(),version,"Public release changed during run");
assert.equal(failed,0,"Role readback failure count");
