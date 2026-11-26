'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium, expect } = require('@playwright/test');

const config = require('./target.json');
const builds = require('./sealed-builds.json');
const {phase, candidateVersion, service, workerRevision} = config;
assert.ok(['private','stage','live'].includes(phase));
const isPrivate = phase === 'private';
const original = 'https://original-demo.hakwonplus.com';
const dawon = 'https://demo.hakwonplus.com';
const hosts = new Set([original,dawon]);
const overrides = phase === 'stage' ? {
  'Cloudflare-Workers-Version-Overrides': service+'="'+candidateVersion+'"',
} : {};
const check = expect.configure({timeout:35000});
const rolebar = '#dawon-demo-switcher';
const compareLabel = '학원플러스 원본';
const expectedRoles = [compareLabel,'관리자','학생','학부모'];

const go = (page,url) => page.goto(url,{waitUntil:'domcontentloaded'});
const sameApi = (response,host,predicate) => {
  const url = new URL(response.url());
  return url.origin === host && predicate(url,response.request().method());
};
const dataRows = body => Array.isArray(body) ? body : (body.results || body.rows || []);
const visible = async locator => { await check(locator).toBeVisible(); return locator; };

function launch() {
  if (!isPrivate) return chromium.launch();
  const spki = process.env.R49_FIXTURE_SPKI;
  assert.match(spki,/^[a-zA-Z0-9+/]{43}=$/);
  return chromium.launch({args:[
    '--host-resolver-rules=MAP demo.hakwonplus.com 127.0.0.1:19449, MAP original-demo.hakwonplus.com 127.0.0.1:19449, MAP * ~NOTFOUND, EXCLUDE localhost',
    '--ignore-certificate-errors-spki-list='+spki,'--no-proxy-server',
  ]});
}

async function readIdentity(page) {
  const response = await page.goto(dawon+'/version.json');
  assert.equal(response.status(),200);
  const identity = await response.json();
  assert.equal(identity.revision,workerRevision);
  assert.equal(identity.version,config.uiVersion);
  assert.equal(identity.originVersion,config.adminVersion);
  assert.equal(identity.productionApi,false);
  return {revision:identity.revision,dawonVersion:identity.version};
}

async function inspect(page, width, section) {
  const layout = await page.evaluate(() => ({
    screen:innerWidth, width:document.documentElement.scrollWidth,
    main:document.querySelector('main')?.scrollWidth || 0,
  }));
  assert.equal(layout.screen,width);
  assert.ok(layout.width <= width+1,section+' overflows viewport '+JSON.stringify(layout));
  const file = phase+'-original-'+section+'-'+width+'.png';
  await page.screenshot({path:file,animations:'disabled'});
  return {file,layout};
}

async function bar(page, active) {
  const nav = page.locator(rolebar);
  const links = nav.getByRole('link');
  await check(links).toHaveCount(4);
  const labels = (await links.allTextContents()).map(t=>t.trim());
  assert.deepEqual(labels,expectedRoles);
  await check(nav.locator('[aria-current="page"]')).toHaveText(active);
  return nav;
}

async function menu(page, name) {
  const drawer = page.getByRole('button', {name:'메뉴 열기',exact:true});
  if (await drawer.isVisible()) await drawer.click();
  const navigation=page.getByRole('navigation',{name:'주요 메뉴'}).filter({visible:true});
  await navigation.getByRole('link',{name,exact:true}).first().click();
}

async function nativeRoster(page) {
  const list = page.waitForResponse(r => sameApi(r,original,(u,m)=>m==='GET' && u.pathname==='/api/v1/students/'));
  await menu(page,'학생');
  const response = await list;
  assert.equal(response.status(),200,'native /students/ must load');
  assert.equal((await response.request().allHeaders())['x-tenant-code'],'hakwonplus');
  const rows = dataRows(await response.json());
  assert.ok(rows.length>0,'native roster empty');
  await visible(page.locator('tbody tr').first());
  await check(page.getByText(/학생 목록을 불러올 수 없습니다|학생 명단을 불러오는 중/)).toHaveCount(0);
  return rows;
}

async function nativeStudent(page, row, guard) {
  assert.ok(Number.isSafeInteger(row.id));
  guard.studentId=row.id;
  const ready=page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='GET' && u.pathname==='/api/v1/students/'+row.id+'/'));
  const rowLink=page.locator('tbody tr').filter({has:page.getByText(row.name,{exact:true})}).first();
  await visible(rowLink);
  await rowLink.click();
  const response=await ready;
  assert.equal(response.status(),200,'native student detail must load');
  const dialog=await visible(page.getByRole('dialog').last());
  await check(dialog.getByText(row.name,{exact:true}).first()).toBeVisible();
  return {detail:await response.json(),dialog};
}

async function persistMemo(page, guard, before, dialog) {
  assert.equal(guard.phase,'private');
  const desired='QA-R49 격리 저장 예시';
  const previous=before.memo || '';
  guard.allowedMemos=new Set([desired,previous]);
  const note=async (container,value) => {
    const open=container.getByRole('button',{name:'연락처·메모 보기'});
    if (await open.isVisible()) await open.click();
    const textarea=await visible(container.getByRole('textbox',{name:'학생 공통 메모'}));
    await textarea.fill(value);
    const save=page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='PATCH' && u.pathname==='/api/v1/students/'+guard.studentId+'/'));
    await textarea.blur();
    const result=await save;
    assert.equal(result.status(),200,'native memo write failed');
    assert.equal((await result.json()).memo || '',value);
  };
  let changed=false;
  try {
    await note(dialog,desired);
    changed=true;
    const ready=page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='GET' && u.pathname==='/api/v1/students/'+guard.studentId+'/'));
    await page.reload({waitUntil:'domcontentloaded'});
    const readback=await ready;
    assert.equal(readback.status(),200);
    assert.equal((await readback.json()).memo,desired);
  } finally {
    if (changed) await note(await visible(page.getByRole('dialog').last()),previous);
  }
  guard.allowedMemos.clear();
  return {mutatedOneSyntheticStudent:true,reloaded:true,restored:true};
}

async function nativeLecture(page, width) {
  const response=page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='GET' && u.pathname==='/api/v1/lectures/lectures/'));
  await menu(page,'강의');
  const query=await response;
  assert.equal(query.status(),200,'native lectures must load');
  const courses=dataRows(await query.json());
  assert.ok(courses.length>0,'no native lectures');
  const select=page.locator('a[href^="/workspace/lectures/"]').filter({hasNotText:/지난 강의|강의 생성/});
  const courseLink=await visible(select.filter({hasText:'공통수학 정규반'}).first());
  const lecturePath=await courseLink.getAttribute('href');
  assert.match(lecturePath,/^\/workspace\/lectures\/\d+$/);
  await courseLink.click();
  await check(page).toHaveURL(/\/workspace\/lectures\/\d+(\/|$)/);
  const lessonCard=await visible(page.getByRole('region',{name:/차시 카드$/}).first());
  const lesson=await visible(lessonCard.getByRole('button').first());
  const attendance = page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='GET' && /\/api\/v1\/(lectures\/attendance|enrollments\/session-enrollments)/.test(u.pathname)));
  await lesson.click();
  await check(page).toHaveURL(/\/sessions\/\d+\/attendance/);
  const attend=await attendance;
  assert.equal(attend.status(),200,'native lesson attendance fetch failed');
  await visible(page.getByRole('tab',{name:'출결',exact:true}).first());
  return {availableCourses:courses.length,layout:await inspect(page,width,'attendance')};
}

async function widthProof(browser,width) {
  const privateSample = width===390 ? '예시 학생 02' : '예시 학생 01';
  const guard={phase,studentId:null,allowedMemos:new Set(),blockedWrites:0};
  const context=await browser.newContext({viewport:{width,height:width===390?844:960},
    timezoneId:'Asia/Seoul',serviceWorkers:'block',extraHTTPHeaders:overrides});
  const errors=[];
  try {
    await context.route('**/*',route=>{
      const request=route.request();
      const url=new URL(request.url());
      if (['data:','blob:'].includes(url.protocol)) return route.continue();
      if (!hosts.has(url.origin)) return route.abort();
      if (!url.pathname.startsWith('/api/v1/')) return route.continue();
      const method=request.method();
      if (['GET','HEAD','OPTIONS'].includes(method)) return route.continue();
      if (method==='POST' && ['/api/v1/reference/session/','/api/v1/students/demo-session/','/api/v1/token/refresh/'].includes(url.pathname)) return route.continue();
      if (isPrivate && url.origin===original && guard.studentId &&
        url.pathname==='/api/v1/students/'+guard.studentId+'/' && method==='PATCH') {
        const payload=request.postDataJSON();
        if(payload && Object.keys(payload).length===1 && guard.allowedMemos.has(payload.memo)) return route.continue();
      }
      guard.blockedWrites++;
      return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message.replace(/https?:\/\/\S+/g,'[url]')));
    const identity=await readIdentity(page);
    await go(page,dawon+'/?preview=student');
    const initial=await bar(page,'학생');
    await initial.getByRole('link',{name:compareLabel,exact:true}).click();
    await check(page).toHaveURL(/^https:\/\/original-demo\.hakwonplus\.com\//);
    await bar(page,compareLabel);
    const modules = await page.locator("script[type=module][src]").evaluateAll(elements => elements.map(el => new URL(el.src).pathname));
    assert.ok(modules.includes(builds.original.entry),"exact native original entry was not served");
    const launchButton=await visible(page.getByRole('button',{name:'학원플러스 원본 열기'}));
    const session=page.waitForResponse(r=>sameApi(r,original,(u,m)=>u.pathname==='/api/v1/reference/session/' && m==='POST'));
    await launchButton.click();
    assert.equal((await session).status(),200);
    await check(page).toHaveURL(/\/workspace\/dashboard/);
    await visible(page.getByRole('heading',{name:'대시보드',exact:true}).first());
    await visible(page.locator('#arrival-overview-title'));
    await visible(page.getByText('발송 준비를 확인해 주세요',{exact:true}));
    const notice=page.getByRole('region',{name:'학원 내부 공지'}).locator('a[href*="/notice/"]').first();
    await visible(notice);
    const title=(await notice.locator('span').first().innerText()).trim();
    assert.ok(title.length>0);
    const dashboard=await inspect(page,width,'dashboard');
    await notice.click();
    await visible(page.getByRole('heading',{name:title,exact:true}).first());
    await page.goBack();
    await visible(page.locator('#arrival-overview-title'));
    const rows=await nativeRoster(page);
    const roster=await inspect(page,width,'roster');
    let student=rows[0];
    if(isPrivate){
      const found=page.waitForResponse(r=>sameApi(r,original,(u,m)=>m==='GET' && u.pathname==='/api/v1/students/' && [...u.searchParams.values()].some(v=>v===privateSample)));
      await page.getByPlaceholder('이름 / 아이디 / 전화번호 / 학교 검색').fill(privateSample);
      const search=await found;
      assert.equal(search.status(),200);
      student=dataRows(await search.json()).find(row=>row.name===privateSample);
    }
    assert.ok(student,'designated synthetic QA student missing or not in first page');
    const {detail,dialog}=await nativeStudent(page,student,guard);
    const detailImage=await inspect(page,width,'student');
    const write=isPrivate ? await persistMemo(page,guard,detail,dialog) : null;
    await page.getByRole('dialog').last().getByRole('button',{name:'닫기',exact:true}).click();
    await check(page.getByRole('dialog')).toHaveCount(0);
    const lecture=await nativeLecture(page,width);
    let roles=await bar(page,compareLabel);
    await roles.getByRole('link',{name:'관리자',exact:true}).click();
    await check(page).toHaveURL(/^https:\/\/demo\.hakwonplus\.com\//);
    roles=await bar(page,'관리자');
    await (await visible(page.getByRole('button',{name:'관리자 데모 로그인',exact:true}))).click();
    await visible(page.locator('[data-dawon-staff="admin"]').first());
    roles=await bar(page,'관리자');
    for(const role of ['학생','학부모']){
      await roles.getByRole('link',{name:role,exact:true}).click();
      await check(page.locator('#dw-home-calendar .dw-day')).toHaveCount(7);
      roles=await bar(page,role);
    }
    await roles.getByRole('link',{name:compareLabel,exact:true}).click();
    await visible(page.getByRole('heading',{name:'대시보드',exact:true}).first());
    await bar(page,compareLabel);
    assert.deepEqual(errors,[],'Uncaught browser errors');
    return {width,identity,dashboard,roster,detailImage,nativeRosterPage:rows.length,lecture,write,
            openedStaffNotice:true,roleRoundTrip:true,blockedWrites:guard.blockedWrites};
  } catch(error) {
    const failed=context.pages().at(-1);
    if(failed) {
      console.error('Browser stopped at',new URL(failed.url()).origin+new URL(failed.url()).pathname,'viewport',width);
      await failed.screenshot({path:phase+'-last-view-'+width+'.png',timeout:5000}).catch(()=>{});
    }
    throw error;
  } finally { await context.close(); }
}

(async()=>{
  const browser=await launch();
  try{
    const proof={passed:true,phase,workerRevision,candidateVersion,
      originalFrontend:config.originalFrontend,dawonFrontend:config.dawonFrontend,
      backend:config.backend,results:[]};
    const screens=await Promise.allSettled([1366,390].map(width=>widthProof(browser,width)));
    const failures=screens.filter(screen=>screen.status==='rejected');
    if(failures.length)throw new AggregateError(failures.map(screen=>screen.reason),'Comparison workflow failed');
    proof.results=screens.map(screen=>screen.value);
    await fs.writeFile(phase+'-comparison.json',JSON.stringify(proof,null,2));
    console.log(JSON.stringify(proof));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
