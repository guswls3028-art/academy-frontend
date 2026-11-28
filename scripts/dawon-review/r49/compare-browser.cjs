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

async function dawonParity(page, width, guard) {
  const root = page.locator('main').first();
  const links = page.getByRole('navigation',{name:'업무 메뉴'});
  async function staffMenu(name, expectedPath) {
    let link = links.getByRole('link', {name,exact:true}).filter({visible:true}).first();
    if (!await link.isVisible()) await page.getByRole('button',{name:/메뉴 열기|사이드바 열기/}).filter({visible:true}).first().click();
    await link.click();
    await check(page).toHaveURL(expectedPath);
    await visible(root);
  }
  await staffMenu('강의 관리',/\/workspace\/lectures/);
  await root.getByRole('link').filter({hasText: isPrivate ? 'QA-R47 출결반' : '하이퍼1'}).first().click();
  await root.getByRole('link').filter({hasText: isPrivate ? 'QA-R47 수학' : '샘플고 2학기 중간고사'}).first().click();
  await check(page).toHaveURL(/\/workspace\/lectures\/\d+/);
  const courseUrl = page.url();
  const id = new URL(courseUrl).pathname.match(/\/lectures\/(\d+)/)[1];
  const settings = page.getByRole('button',{name:'강의 설정',exact:true});
  await (await visible(settings)).click();
  const modal = page.getByRole('dialog').last();
  const description = modal.locator('#lecture-description');
  await visible(description);
  assert.equal(await modal.locator('#lecture-instructor').getAttribute('readonly'),'');
  const originalText = await description.inputValue();
  if (isPrivate && width===1366) {
    const endpoint = '/api/v1/lectures/lectures/'+id+'/';
    guard.course = endpoint;
    async function save(value) {
      await description.fill(value);
      const saved=page.waitForResponse(r=>sameApi(r,dawon,(url,m)=>url.pathname===endpoint && m==='PATCH'));
      await modal.getByRole('button',{name:'수정',exact:true}).click();
      const result=await saved;
      assert.equal(result.status(),200,'course settings save');
      assert.equal((await result.json()).description,value);
      await check(modal).toHaveCount(0);
    }
    await save('QA-R50 강의 설정 검수');
    await page.reload({waitUntil:'domcontentloaded'});
    await settings.click();
    await check(description).toHaveValue('QA-R50 강의 설정 검수');
    await save(originalText);
    guard.course=null;
  } else await modal.getByRole('button',{name:'취소',exact:true}).click();
  const cards = page.getByRole('region',{name:/차시 카드$/});
  const card = isPrivate ? cards.filter({hasText:'QA-R47 수업 1'}).first() : cards.first();
  await card.getByRole('button').first().click();
  await check(page).toHaveURL(/\/sessions\/\d+\/attendance/);
  const sessionPath = new URL(page.url()).pathname.split('/').slice(0,-1).join('/');
  const tabs = [['출결','attendance'],['성적','scores'],['시험','exams'],['과제','assignments'],['공지·게시판','notice'],['영상','videos']];
  const steps=[];
  for (const [label,path] of tabs) {
    await page.getByRole('tab',{name:label,exact:true}).click();
    await check.poll(()=>new URL(page.url()).pathname).toBe(sessionPath+'/'+path);
    await check(root).not.toContainText(/페이지를 찾을 수 없|강의 목록을 불러오지 못/);
    if(path==='attendance') {
      await check(root).not.toContainText('차시·수업일 선택');
      if (width===1366) {
        const options=page.getByRole('group',{name:isPrivate?'QA-R47 학생 1 출결 상태 선택':/출결 상태 선택/}).first();
        await visible(options);
        if (isPrivate) {
          async function mark(name) {
            const saved=page.waitForResponse(r=>sameApi(r,dawon,(u,m)=>m==='PATCH' && /^\/api\/v1\/lectures\/attendance\/\d+\/$/.test(u.pathname)));
            await options.getByRole('button',{name,exact:true}).click();
            assert.equal((await saved).status(),200,'attendance status save');
          }
          guard.attendance=true;
          await mark('지각');
          await page.reload({waitUntil:'domcontentloaded'});
          await check(options.getByRole('button',{name:'지각',exact:true})).toHaveAttribute('aria-pressed','true');
          await mark('미입력');
          guard.attendance=false;
        }
      }
    }
    const screenText = {scores:/학생 이름 검색|이름 검색|성적 편집|성적 입력|성적표|성적 데이터/, exams:/시험 추가|묶음 불러오기|시험 정보/, assignments:/과제 추가|묶음 불러오기|과제 정보/, notice:/공지사항/, videos:/영상 추가|등록된 영상/};
    if(screenText[path]) await check(root).toContainText(screenText[path]);
    await page.screenshot({path:phase+'-dawon-'+path+'-'+width+'.png',animations:'disabled'});
    steps.push(path);
  }
  const destinations=[['시험 관리',/\/workspace\/exams/],['시험 결과·통계',/\/workspace\/results/],['영상',/\/workspace\/videos/],['클리닉',/\/workspace\/clinic/],['가이드',/\/workspace\/guide/]];
  for (const [name,pattern] of destinations) {
    await staffMenu(name,pattern);
    if(name==='시험 결과·통계') {
      await root.getByText('강의별 탐색',{exact:true}).first().click();
      await check(page).toHaveURL(/\/results\/tree/);
    }
    if(name==='클리닉') {
      const load=page.waitForResponse(r=>sameApi(r,dawon,(u,m)=>u.pathname==='/api/v1/clinic/settings/'&&m==='GET'));
      await root.getByText('패스카드',{exact:true}).first().click();
      assert.equal((await load).status(),200);
      const mode=root.getByRole('checkbox',{name:/매일 자동으로 색상 바꾸기/});
      await visible(mode);
      if(isPrivate && width===1366) {
        const old=await mode.isChecked();
        guard.passcard=true;
        async function apply(value) {
          await mode.setChecked(value);
          const save=page.waitForResponse(r=>sameApi(r,dawon,(u,m)=>m==='PATCH' && u.pathname==='/api/v1/clinic/settings/'));
          await root.getByRole('button',{name:'학생 화면에 적용',exact:true}).click();
          assert.equal((await save).status(),200);
        }
        await apply(!old);
        await page.reload({waitUntil:'domcontentloaded'});
        await check.poll(()=>mode.isChecked()).toBe(!old);
        await apply(old);
        guard.passcard=false;
      }

    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' page overflows viewport');
  }
  return {tabs:steps,courseSettings:true,reloadedAndRestored:isPrivate && width===1366,menus:destinations.map(([name])=>name)};
}

async function learnerDetails(page,width,guard) {
  const shots=[];
  let demoPosts=0;
  const onRequest=req=>{
    if(req.method()==='POST' && req.url()===dawon+'/api/v1/students/demo-session/') demoPosts++;
  };
  page.on('request',onRequest);
  const screenshot=async name=>{const file=phase+'-'+name+'-'+width+'.png';await page.screenshot({path:file});shots.push(file);};
  const goRole=async role=>{
    await go(page,dawon+'/?preview='+role+'&date=2026-11-19');
    await check(page.locator('body')).toHaveAttribute('data-role',role);
    await check(page.locator('#dw-home-calendar .dw-day')).toHaveCount(7);
  };
  const detail=async (role)=>{
    const date=await page.evaluate(async()=>{
      const data=await (await fetch('/api/v1/students/demo-learning/',{credentials:'omit'})).json();
      const sessions=data.sessions.filter(s=>s.exams?.some(e=>e.result_available===true&&e.score!=null));
      return sessions.find(s=>s.date==='2026-11-19')?.date??sessions[0]?.date;
    });
    assert.ok(date,'no actual learner exam result is populated');
    await go(page,dawon+'/learn/exam?view=day&date='+date+'&originDate=2026-11-19'+(role==='guardian'?'&preview=guardian':''));
    const action=page.locator('main a[href*="/result?"]').first();
    await action.waitFor({state:'visible'});
    const report=page.waitForResponse(r=>sameApi(r,dawon,(u,m)=>m==='GET'&&/^\/api\/v1\/student\/results\/me\/exams\/\d+\/$/.test(u.pathname)));
    await action.click();
    await check(page).toHaveURL(/\/student\/exams\/\d+\/result\?/);
    assert.equal((await report).status(),200);
    await visible(page.locator('.student-page-shell h1').first());
    await screenshot(role+'-exam');
    await (await visible(page.locator('.student-page-shell a[href^="/learn/exam?"]').first())).click();
    await check(page).toHaveURL(/\/learn\/exam/);
    assert.equal(new URL(page.url()).searchParams.get('date'),date);
    assert.equal(new URL(page.url()).searchParams.get('originDate'),'2026-11-19');
    if(role==='guardian') assert.equal(new URL(page.url()).searchParams.get('preview'),'guardian');
  };
  await goRole('student');
  const tile=await page.locator('main a[href*="action=ask"]').first().getAttribute('href');
  const footer=await page.locator('[data-dw-tab-key="questions"]').getAttribute('href');
  const drawer=await page.locator('.dw-drawerPanel a[data-dw-menu-key="questions"]').getAttribute('href');
  assert.equal(tile,footer);
  assert.equal(footer,drawer);
  await check(page.locator('main .dw-questionBeta').first()).toBeVisible();
  const earliest=await page.evaluate(async()=>{
    const value=await (await fetch('/api/v1/students/demo-learning/',{credentials:'omit'})).json();
    return value.sessions.map(s=>s.date).filter(Boolean).sort()[0];
  });
  assert.ok(earliest);
  const noLesson=new Date(Date.parse(earliest+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  await go(page,dawon+'/?preview=student&date='+noLesson);
  const closest=await visible(page.locator('.dw-homeDay a.dw-nearest').filter({hasText:'다음 수업'}).first());
  await closest.click();
  await check(page).toHaveURL(new RegExp('[?&]date='+earliest+'(?:[&#]|$)'));
  await goRole('student');
  const schoolPath='/api/v1/results/school-reports/me/';
  const gradeReads=[];
  const collect=async r=>{
    const u=new URL(r.url());
    if(u.origin===dawon&&u.pathname===schoolPath&&r.request().method()==='GET'){
      assert.equal(r.status(),200);
      gradeReads.push([u.searchParams.get('academic_year'),u.searchParams.get('semester'),u.searchParams.get('exam_round')]);
    }
  };
  page.on('response',collect);
  await (await visible(page.locator('main a[href="/student/submit/school-report?from=terms"]').first())).click();
  await check(page).toHaveURL(/\/student\/submit\/school-report\?from=terms/);
  const grades=page.getByRole('region',{name:'학년별 학교 성적'});
  const term=label=>grades.getByRole('row').filter({has:page.getByRole('rowheader',{name:label,exact:true})});
  await check(grades.getByRole('rowheader')).toHaveText(['1학기 중간','1학기 기말','2학기 중간','2학기 기말']);
  await check(grades.getByText('불러오는 중…')).toHaveCount(0);
  await check(grades.getByRole('link',{name:/성적 보기/})).toHaveCount(0);
  const year=Number(await grades.getByRole('combobox',{name:'조회할 학년도'}).inputValue());
  assert.deepEqual(new Set(gradeReads.map(([,semester,round])=>semester+round)),new Set(['1first','1second','2first','2second']));
  const exam=term('1학기 중간');
  if(isPrivate){
    await check(exam.getByText('수학',{exact:true})).toBeVisible();
    await check(exam.locator('strong')).toHaveText('0');
    await check(term('1학기 기말').locator('strong')).toHaveText('85');
  }
  await screenshot('school-four-terms');
  const edit=exam.getByRole('button',{name:/1학기 중간 점수 (수정|입력)/});
  await edit.click();
  await visible(page.getByLabel('받은 점수 1'));
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await check(grades.getByRole('rowheader')).toHaveCount(4);
  if(isPrivate){
    guard.schoolWrite=true;
    try{
      for(const expected of ['71','0']){
        await edit.click();
        await page.getByLabel('받은 점수 1').fill(expected);
        const save=page.waitForResponse(r=>sameApi(r,dawon,(u,m)=>m==='PUT'&&u.pathname===schoolPath));
        await page.getByRole('button',{name:'성적표 제출',exact:true}).click();
        assert.equal((await save).status(),200);
        await check(exam.locator('strong')).toHaveText(expected);
        await page.reload({waitUntil:'domcontentloaded'});
        await check(exam.locator('strong')).toHaveText(expected);
      }
    }finally{guard.schoolWrite=false;}
  }
  await grades.getByRole('combobox',{name:'조회할 학년도'}).selectOption(String(year-1));
  await check(grades.getByRole('heading',{name:String(year-1)+'학년도 학교 성적'})).toBeVisible();
  await check(grades.getByRole('rowheader')).toHaveCount(4);
  await (await visible(page.getByRole('link',{name:'학습 홈',exact:true}).last())).click();
  await check(page.locator('body')).toHaveAttribute('data-role','student');
  page.off('response',collect);
  await detail('student');
  const beforeClinic=demoPosts;
  await go(page,dawon+'/learn/clinic');
  await (await visible(page.getByRole('link',{name:'클리닉 예약·내 일정'}).first())).click();
  await check(page).toHaveURL(/\/student\/clinic\?from=menu/);
  await visible(page.getByRole('tab',{name:/예약/}).first());
  assert.equal(demoPosts,beforeClinic,'compatible student session minted again');
  await screenshot('student-clinic');
  await (await visible(page.getByRole('button',{name:'뒤로',exact:true}))).click();
  await check(page).toHaveURL(/\/learn\/clinic/);
  await goRole('guardian');
  await detail('guardian');
  const afterGuardian=demoPosts;
  await goRole('guardian');
  await (await visible(page.locator('[data-dw-tab-key="questions"]'))).click();
  await check(page).toHaveURL(/\/student\/community\?tab=counsel&panel=form/);
  await visible(page.getByRole('heading',{name:'상담하기',exact:true}).last());
  await screenshot('guardian-counsel');
  await page.goBack();
  await check(page.locator('body')).toHaveAttribute('data-role','guardian');
  assert.equal(new URL(page.url()).searchParams.get('date'),'2026-11-19');
  assert.equal(demoPosts,afterGuardian,'compatible guardian session minted again');
  await go(page,dawon+'/student/clinic?from=menu');
  await check(page).toHaveURL(/\/(guardian|student)$/);
  assert.equal(demoPosts,afterGuardian,'unselected cross-role route minted a session');
  page.off('request',onRequest);
  return {passed:true,shots,roleTransitions:demoPosts,calendarDate:'2026-11-19'};
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
      if(isPrivate && url.origin===dawon && method==='PATCH' &&
          (guard.course===url.pathname || (guard.passcard && url.pathname==='/api/v1/clinic/settings/') || (guard.attendance && /^\/api\/v1\/lectures\/attendance\/\d+\/$/.test(url.pathname)))) return route.continue();
      if(isPrivate && guard.schoolWrite && url.origin===dawon && method==='PUT' && url.pathname==='/api/v1/results/school-reports/me/') return route.continue();
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
    const parity=await learnerDetails(page,width,guard);
    roles=await bar(page,'학부모');
    for(const role of ['학생','학부모']){
      await roles.getByRole('link',{name:role,exact:true}).click();
      await check(page.locator('#dw-home-calendar .dw-day')).toHaveCount(7);
      roles=await bar(page,role);
    }
    await roles.getByRole('link',{name:compareLabel,exact:true}).click();
    await visible(page.getByRole('heading',{name:'대시보드',exact:true}).first());
    await bar(page,compareLabel);
    assert.deepEqual(errors,[],'Uncaught browser errors');
    return {width,parity,identity,dashboard,roster,detailImage,nativeRosterPage:rows.length,lecture,write,
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
    for(const width of [1366,390])proof.results.push(await widthProof(browser,width));
    await fs.writeFile(phase+'-comparison.json',JSON.stringify(proof,null,2));
    console.log(JSON.stringify(proof));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
