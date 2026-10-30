import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { observeReleaseTestResult } from "../run-development-release-canary.mjs";

const read = file => readFileSync(new URL("../../" + file, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const policyModule = await import("data:text/javascript;base64," + Buffer.from(
  stripTypeScriptTypes(read("e2e/helpers/releaseApiBoundary.ts"))
).toString("base64"));

// Decode actual producer output through the same closed writer used by release
// evidence. Assertions run outside the producer's best-effort logging callback.
function contextReport(outputs, specFile) {
  return {
    stats: { expected: 0, skipped: 0, unexpected: 1, flaky: 0 },
    suites: [{ specs: [{ file: specFile, tests: [{ status: "unexpected", results: [{
      status: "failed", workerIndex: 0, errors: [],
      stdout: outputs.map(value => ({ text: JSON.stringify(value) + "\n" })),
    }] }] }] }],
  };
}
function assertDecoded(outputs, marker, destination, specFile) {
  const report = contextReport(outputs, specFile);
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.equal(observed.rejectedFailureObservationCount, 0);
  assert.equal(observed.droppedFailureObservationCount, 0);
  assert.deepEqual(observed[destination], outputs.map(value => ({
    specFile, resultOrdinal: 1, ...value[marker],
  })));
  assert.deepEqual(observed.stats, report.stats);
}

function endedCourseHarness({ crossMidnight = false, restoredPatch = {} } = {}) {
  const source = read("e2e/student/student-parent-assessment-realuse.spec.ts");
  const moduleDate = source.match(/^const todayKst = .+;$/m)?.[0];
  const begin = source.indexOf("async function verifyEndedCourseTodos(");
  const end = source.indexOf("\nasync function verifyManualScorePrecision(", begin);
  assert.ok(moduleDate && begin >= 0 && end > begin);
  let now = Date.parse("2026-10-30T14:59:02.805Z");
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const currentDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(now));
  const patches = [], history = [], summaries = [], links = [], reloads = [], overflows = [];
  let role = "parent", width = null, logins = 0, logouts = 0, gradeReads = 0;
  const lecture = { is_active: true, end_date: null };
  const state = () => ({ role, width });
  const locator = kind => ({
    kind,
    filter({ hasText }) {
      assert.equal(hasText, kind === "history" ? "종료된 강의" : "synthetic exam");
      return this;
    },
    first() { return this; },
    getByText(text, options) {
      assert.equal(text, "정리됨"); assert.equal(options.exact, true);
      return locator("summary");
    },
    async click() {
      assert.equal(kind, "history"); history.push(state());
      // Advance during the last UI loop, not before entering the real helper.
      if (crossMidnight && history.length === 4) now = Date.parse("2026-10-30T15:00:01.000Z");
    },
  });
  const page = {
    async setViewportSize(value) { width = value.width; assert.equal(value.height, 900); },
    locator: selector => locator(selector === "summary" ? "history" : "student-summary"),
    getByRole: kind => locator(kind === "link" ? "link" : "parent-summary"),
  };
  const sandbox = {
    Date: ClockDate, Intl, created: { examId: 17, lectureId: 23 }, examTitle: "synthetic exam", QA_BASE: "http://fixture.invalid",
    expect: actual => ({
      toBe: expected => assert.equal(actual, expected),
      toMatchObject: expected => {
        assert.ok(actual);
        for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
      },
      async toBeVisible() {
        assert.ok(["summary", "link"].includes(actual.kind));
        (actual.kind === "summary" ? summaries : links).push(state());
      },
    }),
    expectApi: async (_request, method, path, _token, data, accepted) => {
      if (method === "PATCH") {
        assert.equal(path, "/lectures/lectures/23/"); assert.equal(accepted[0], 200);
        patches.push({ ...data }); Object.assign(lecture, data); return { ...lecture };
      }
      assert.equal(method, "GET");
      const active = lecture.is_active && (lecture.end_date === null || lecture.end_date >= currentDay());
      if (path === "/student/exams/?include_upcoming=true") return { items: active ? [{ id: 17 }] : [] };
      assert.equal(path, "/student/grades/"); gradeReads++;
      return { exams: [{ exam_id: 17, lecture_active: active, learning_todo_eligible: active, total_score: 60,
        ...(patches.length === 2 ? restoredPatch : {}) }] };
    },
    logoutStudentApp: async () => { logouts++; },
    loginThroughUi: async () => { role = "student"; logins++; },
    gotoAndSettle: async (_page, url) => assert.match(url, /\/student\/(dashboard|grades)$/),
    reloadStudentApp: async () => { reloads.push(state()); },
    assertNoHorizontalOverflow: async () => { overflows.push(state()); },
  };
  const api = vm.runInNewContext(stripTypeScriptTypes(`${moduleDate}\n${source.slice(begin, end)}\n({ todayKst, verifyEndedCourseTodos });`), sandbox);
  return {
    run: () => api.verifyEndedCourseTodos(page, {}, { access: "synthetic-admin" }, {}, { access: "synthetic-student" }),
    moduleDate: api.todayKst, patches, history, summaries, links, reloads, overflows,
    counts: () => ({ logins, logouts, gradeReads }),
  };
}

for (const crossMidnight of [false, true]) {
  test(`actual ended-course restore uses inclusive current KST day (${crossMidnight ? "midnight crossing" : "same day"})`, async () => {
    const h = endedCourseHarness({ crossMidnight });
    await h.run();
    assert.equal(h.moduleDate, "2026-10-30");
    assert.deepEqual(h.patches, [
      { start_date: "2026-10-29", end_date: "2026-10-29", is_active: true },
      { end_date: crossMidnight ? "2026-10-31" : "2026-10-30" },
    ]);
    const journey = ["parent", "student"].flatMap(role => [390, 1366].map(width => ({ role, width })));
    for (const observations of [h.history, h.summaries, h.links, h.reloads, h.overflows]) assert.deepEqual(observations, journey);
    assert.deepEqual(h.counts(), { logins: 1, logouts: 1, gradeReads: 3 });
  });
}

for (const [field, value] of [["lecture_active", false], ["learning_todo_eligible", false], ["total_score", 61]]) {
  test(`actual ended-course restore still rejects incorrect ${field}`, async () => {
    const h = endedCourseHarness({ crossMidnight: true, restoredPatch: { [field]: value } });
    await assert.rejects(h.run(), error => error.code === "ERR_ASSERTION" && error.message.startsWith(field));
    assert.equal(h.patches[1].end_date, "2026-10-31");
  });
}

test("closed workflow helper failure locations retain only registered source names", () => {
  const helpers = ["excelEnrollmentRealuse.ts", "excelAssessmentRealuse.ts", "attendanceExcelRealuse.ts", "homeworkCriteriaRealuse.ts", "excelImport.ts"];
  const report = contextReport([], "student-parent-learning-realuse.spec.ts");
  report.suites[0].specs[0].tests[0].results[0].errors = [...helpers, "private-token.ts"].map(file => ({
    message: "private-token https://private.example/?name=secret",
    location: { file: `/private/secret/${file}`, line: 12, column: 7 },
  }));
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.deepEqual(observed.failureLocations.map(value => value.sourceFile).sort(), [...helpers].sort());
  assert.ok(observed.failureLocations.every(value => value.line === 12 && value.column === 7));
  assert.equal(observed.reportedTestErrors.at(-1).sourceFile, null);
  assert.doesNotMatch(JSON.stringify(observed), /private-token|private\.example|\/private\/secret/);
});

const learningFailureSample = { schema: "learning-flow-failure/v1", phase: "teacher-video-reload", viewport: 390, kind: "assertion" };
const homeworkFailureSample = { schema: "homework-flow-failure/v1", phase: "criteria-save", viewport: 1366, threshold: 95, kind: "assertion" };
const flowFailureCases = [
  ["releaseLearningFlowFailure", "learningFlowFailures", "student-parent-learning-realuse.spec.ts", learningFailureSample],
  ["releaseHomeworkFlowFailure", "homeworkFlowFailures", "student-parent-homework-realuse.spec.ts", homeworkFailureSample],
];

test("closed workflow failure observations bind the exact spec and keep only three primary markers per result", () => {
  for (const [marker, destination, spec, sample] of flowFailureCases) {
    const report = contextReport(Array.from({ length: 4 }, () => ({ [marker]: sample })), spec);
    const observed = observeReleaseTestResult(JSON.stringify(report));
    assert.equal(observed[destination].length, 3);
    assert.equal(observed.droppedFailureObservationCount, 1);
    assert.equal(observed.rejectedFailureObservationCount, 0);
    assert.ok(observed[destination].every(value => value.specFile === spec && value.resultOrdinal === 1));
    assert.deepEqual(observed.stats, report.stats);
    const wrongSpec = observeReleaseTestResult(JSON.stringify(contextReport([{ [marker]: sample }], "public-video-realuse.spec.ts")));
    assert.deepEqual(wrongSpec[destination], []);
    assert.equal(wrongSpec.rejectedFailureObservationCount, 1);
  }
});

test("closed workflow failure observations reject private fields and impossible stages", () => {
  for (const [marker, destination, spec, sample] of flowFailureCases) {
    const invalid = [null, [], {}, ...[
      { schema: "private-token" }, { phase: "private-token" }, { kind: "private-token" },
      { viewport: "390" }, { viewport: 391 }, { viewport: -1 }, { viewport: 390.5 },
      { token: "private-token" }, { body: "private-token" }, { selector: "private-token" },
      { rawError: "private-token" }, { url: "https://private.example/?token=secret" },
    ].map(patch => ({ ...sample, ...patch }))];
    if (marker === "releaseHomeworkFlowFailure") invalid.push(
      { ...sample, threshold: null }, { ...sample, threshold: 80 }, { ...sample, threshold: "95" },
      { ...sample, viewport: null }, { ...sample, phase: "criteria-invalid-input", threshold: 90 },
      { ...sample, phase: "criteria-setup" }, { ...sample, phase: "feedback-score-edit" },
      { ...sample, phase: "feedback-setup", threshold: null },
    );
    for (const value of invalid) {
      const observed = observeReleaseTestResult(JSON.stringify(contextReport([{ [marker]: value }], spec)));
      assert.deepEqual(observed[destination], []);
      assert.equal(observed.rejectedFailureObservationCount, 1);
      assert.doesNotMatch(JSON.stringify(observed), /private-token|private\.example|token=secret/);
    }
  }
});

// Run the unchanged teacher/helper control flow with deterministic fault boundaries.
function registerLearningFaultTests() {
  const helper=read('e2e/helpers/attendanceExcelRealuse.ts');
  const spec=read('e2e/student/student-parent-learning-realuse.spec.ts');
  const emitterStart=helper.indexOf('const LEARNING_FLOW_PHASES');
  const emitter=emitterStart<0?'':helper.slice(emitterStart,helper.indexOf('type ExportStudent'));
  const attendance=helper.slice(helper.indexOf('export async function verifyAttendanceExcel'));
  const teacher=spec.slice(spec.indexOf('    const teacherContext ='),spec.indexOf('    const primaryTokens =',spec.indexOf('    const teacherContext =')));
  const compiled=stripTypeScriptTypes(`${emitter}\n${attendance}\nasync function runTeacher(){${teacher}}\n({runTeacher,verifyAttendanceExcel,emit:typeof emitLearningFlowFailure==='function'?emitLearningFlowFailure:undefined});`.replace(/^export /gm,''));
  function harness(stage,{restoreFailure=false,closeFailure=false}={}){
   const primary=new Error('expect(PRIVATE_STUDENT_TOKEN) failed\nhttps://private.invalid/?credential=PRIVATE');
   const cleanup=new Error('cleanup PRIVATE'); const events=[]; const mutations=[]; let reloads=0; let fileSaved=false;
   const locator=(name)=>({filter(){return this;},async fill(){},async click(){if(stage==='teacher-attendance-undo'&&name==='되돌리기')throw primary;}});
   const teacherPage={async route(){},async addInitScript(){},async setViewportSize(){},getByRole:(_,{name}={})=>locator(name),getByText:(name)=>locator(name),async waitForResponse(){return{status:()=>202,request:()=>({postDataJSON:()=>({lecture_id:10})}),json:async()=>({job_id:'00000000-0000-0000-0000-000000000001'})};},async waitForEvent(){return {failure:async()=>{if(stage==='attendance-download')throw primary;return null;},suggestedFilename:()=> 'export.xlsx',saveAs:async()=>{fileSaved=true;}};},async reload(){reloads++;if(stage==='teacher-video-reload'&&reloads===5)throw primary;},async screenshot(){return Buffer.alloc(0);}};
   const context={async newPage(){return teacherPage;},async close(){events.push({close:true});if(closeFailure)throw cleanup;}};
   const students=[{id:1,name:'student1',phone:'01000000001',parent_phone:'01000000002'},{id:2,name:'student2',phone:'01000000003',parent_phone:'01000000004'}];
   const matcher=new Proxy({}, {get:(_,name)=>async()=>{if(stage==='teacher-classes-persisted'&&name==='toHaveAttribute')throw primary;}});
   const sandbox={Error,AggregateError,Buffer,ExcelJS:{Workbook:class {xlsx={readFile:async()=>{if(stage==='attendance-workbook')throw primary;}};}},console:{info:(value)=>events.push(JSON.parse(value))},safeNativeTransportKind:policyModule.safeNativeTransportKind,expect:()=>matcher,
     page:{context:()=>({browser:()=>({newContext:async()=>context})})},request:{},admin:{access:'PRIVATE'},created:{lectureId:10,sessionId:20,attendanceIds:[30]},primary:students[0],sibling:students[1],lectureTitle:'private title',videoTitle:'private video',QA_BASE:'https://private.invalid',
     process:{env:{E2E_LONG_VIDEO_ID:'11',E2E_LONG_VIDEO_TENANT_ID:'12'}},
     testInfo:{outputPath:(name)=>name,async attach(){}},
     installQaStudentParentBoundary:async()=>({assertClean(){}}),attachStrictBrowserGuards:()=>({assertZeroDefects(){}}),seedBrowserAuth:async()=>{},assertNoHorizontalOverflow:async()=>{},
     expectApi:async(_r,method,path,_access,data)=>{
      if(stage==='attendance-prepare'&&path.startsWith('/students/')&&method==='GET')throw primary;
      if(path.startsWith('/media/')){if(stage==='teacher-thumbnail')throw primary;return {thumbnail_url:null};}
      if(method==='PATCH'){
       mutations.push({path,data});
       if(restoreFailure&&data?.name==='student1')throw cleanup;
       return data;
      }
      if(path.startsWith('/students/'))return students[Number(path.split('/')[2])-1];
      if(path.startsWith('/lectures/sessions/'))return {title:'original title',date:null};
      return {status:'PRESENT'};
     },
     gotoAndSettle:async(_page,url)=>{
      const matched=(stage==='teacher-classes-open'&&url.endsWith('/classes'))||(stage==='teacher-attendance-save'&&url.includes('/attendance/'))||(stage==='teacher-session-summary'&&url.includes('/classes/')&&url.includes('/sessions/'))||(stage==='teacher-video-list'&&url.endsWith('/videos'))||(stage==='attendance-submit'&&url.endsWith('/students'));
      if(matched)throw primary;
     }
   };
   const api=vm.runInNewContext(compiled,sandbox);
   if(stage==='teacher-attendance-export')sandbox.verifyAttendanceExcel=async()=>{throw primary;};
   return {api,primary,cleanup,events,mutations,teacherPage,sandbox,fileSaved:()=>fileSaved,markers:()=>{
     const outputs = events.filter(e=>e.releaseLearningFlowFailure);
     assertDecoded(outputs, "releaseLearningFlowFailure", "learningFlowFailures", "student-parent-learning-realuse.spec.ts");
     return outputs.map(e=>e.releaseLearningFlowFailure);
   }};
  }
  for(const phase of ['teacher-thumbnail','teacher-classes-open','teacher-classes-persisted','teacher-attendance-save','teacher-attendance-undo','teacher-session-summary','teacher-video-list','teacher-video-reload']){
   test(`actual teacher block retains primary at ${phase}`,async()=>{
    const h=harness(phase,{closeFailure:true}); await assert.rejects(h.api.runTeacher(),e=>e===h.cleanup);
    const [marker]=h.markers(); assert.ok(marker,'original primary marker must survive cleanup failure');
    assert.equal(marker.phase,phase);assert.equal(marker.kind,'assertion');assert.equal(marker.viewport,phase==='teacher-thumbnail'?null:390);
    assert.ok(h.events.findIndex(e=>e.releaseLearningFlowFailure)<h.events.findIndex(e=>e.close));
    assert.equal(JSON.stringify(h.markers()).includes('PRIVATE'),false);assert.equal(JSON.stringify(h.markers()).includes('private.invalid'),false);
   });
  }
  test('actual attendance preparation preserves exact rejection without mutation',async()=>{
   const h=harness('attendance-prepare');await assert.rejects(h.api.verifyAttendanceExcel(h.teacherPage,{},'PRIVATE',h.sandbox.testInfo,10,'title',20,[1,2]),e=>e===h.primary);
   assert.deepEqual(h.markers().map(m=>[m.phase,m.viewport]),[['attendance-prepare',null]]);assert.equal(h.mutations.length,0);
  });
  test('actual attendance primary and restore failures remain ordered and aggregate unchanged',async()=>{
   const h=harness('attendance-submit',{restoreFailure:true});await assert.rejects(h.api.verifyAttendanceExcel(h.teacherPage,{},'PRIVATE',h.sandbox.testInfo,10,'title',20,[1,2]),e=>e instanceof AggregateError&&e.errors[0]===h.primary&&e.errors[1]===h.cleanup);
   assert.deepEqual(h.markers().map(m=>[m.phase,m.viewport]),[['attendance-submit',1366],['attendance-restore',1366]]);
   assert.equal(h.mutations.some(m=>m.data.title==='original title'),true);assert.equal(h.mutations.some(m=>m.data.name==='student2'),true);
  });
  test('actual teacher plus actual attendance failure emits at most three closed records',async()=>{
   const h=harness('attendance-submit',{restoreFailure:true});await assert.rejects(h.api.runTeacher(),e=>e instanceof AggregateError&&e.errors[0]===h.primary&&e.errors[1]===h.cleanup);
   assert.deepEqual(h.markers().map(m=>[m.phase,m.viewport]),[['attendance-submit',1366],['attendance-restore',1366],['teacher-attendance-export',null]]);
   assert.equal(JSON.stringify(h.markers()).includes('PRIVATE'),false);assert.equal(h.events.at(-1).close,true);
  });
  test('actual emitter rejects open fields and never replaces failure if logging fails',()=>{
   const h=harness('unused');assert.equal(typeof h.api.emit,'function');
   h.api.emit(h.primary,'PRIVATE',390);h.api.emit(h.primary,'attendance-prepare',999);assert.equal(h.markers().length,0);
   h.api.emit(h.primary,'attendance-prepare',null);assert.deepEqual(Object.keys(h.markers()[0]).sort(),['kind','phase','schema','viewport']);
   h.sandbox.console.info=()=>{throw new Error('collector unavailable');};assert.doesNotThrow(()=>h.api.emit(h.primary,'attendance-prepare',null));
  });

  for(const phase of ['attendance-download','attendance-workbook']){
   test(`actual attendance stage is retained at ${phase}`,async()=>{
    const h=harness(phase);await assert.rejects(h.api.verifyAttendanceExcel(h.teacherPage,{},'PRIVATE',h.sandbox.testInfo,10,'title',20,[1,2]),e=>e===h.primary);
    assert.deepEqual(h.markers().map(m=>[m.phase,m.viewport]),[[phase,1366]]);
    assert.equal(h.fileSaved(),phase==='attendance-workbook');assert.equal(h.mutations.some(m=>m.data.title==='original title'),true);
   });
  }

  for(const prefix of ['Release API boundary failed:','Release request rejected']){
   test(`closed boundary classification: ${prefix}`,()=>{
    const h=harness('unused');h.api.emit(new Error(prefix+' PRIVATE\nhttps://private.invalid'),'attendance-prepare',null);
    assert.equal(h.markers()[0].kind,'boundary');assert.equal(JSON.stringify(h.markers()).includes('PRIVATE'),false);
   });
  }
}
registerLearningFaultTests();

test("actual homework flow retains primary failures through cleanup and closed decoding", async () => {
  const helper = read("e2e/helpers/homeworkCriteriaRealuse.ts");
  const spec = read("e2e/student/student-parent-homework-realuse.spec.ts");
  const extract = (source, start, end) => {
    const begin = source.indexOf(start), finish = end ? source.indexOf(end, begin + start.length) : source.length;
    assert.ok(begin >= 0 && finish > begin);
    return stripTypeScriptTypes(source.slice(begin, finish)).replace(/^export /gm, '');
  };
  const emitter = new Function('safeNativeTransportKind', `${extract(helper, 'export function emitHomeworkFlowFailure(', '\ntype CriteriaScenario')}; return emitHomeworkFlowFailure;`)(policyModule.safeNativeTransportKind);
  const cases = [];
  const primary = new Error('expect(received).toBe(expected) private-user secret-token https://private.invalid/?token=secret');
  const teardown = new Error('cleanup-secret');
  const assertPrivate = value => {
    assert.doesNotMatch(JSON.stringify(value), /private-user|secret-token|private\.invalid|cleanup-secret|987654/);
    assertDecoded(value, "releaseHomeworkFlowFailure", "homeworkFlowFailures", "student-parent-homework-realuse.spec.ts");
  };
  const logsFor = () => { const logs = []; return { logs, emit: (error, checkpoint) => emitter(error, checkpoint, value => logs.push(value)) }; };
  const collectKinds = [
    ['boundary', new Error('Release API boundary failed: private-user')],
    ['boundary', new Error('Release request rejected [transport] GET /private-user?token=secret-token')],
    ['assertion', primary],
    ['locator-timeout', new Error('locator.click: Timeout private-user')],
    ['transport', new Error('socket hang up')],
    ['other', new Error('private-user secret-token')],
  ];
  for (const [kind, error] of collectKinds) {
    const logs = [];
    emitter(error, { phase: 'criteria-save', viewport: 1366, threshold: 95, token: 'secret-token' }, value => logs.push(value));
    assert.deepEqual(logs, [{ releaseHomeworkFlowFailure: { schema: 'homework-flow-failure/v1', phase: 'criteria-save', viewport: 1366, threshold: 95, kind } }]);
    assertPrivate(logs);
    cases.push(error.message.startsWith('Release request rejected') ? 'closed-kind-boundary-request-rejected' : `closed-kind-${kind}`);
  }

  // Execute the real feedback function. Its original primary failure must be
  // emitted before the existing finally block throws a distinct cleanup failure.
  {
    const { logs, emit } = logsFor();
    const order = [];
    let cleanupFails = true, loggingFails = false;
    const staffPage = { on() {} };
    const context = { newPage: async () => staffPage, close: async () => { order.push('cleanup'); if (cleanupFails) throw teardown; } };
    const parent = { context: () => ({ browser: () => ({ newContext: async () => context }) }), setViewportSize: async () => {} };
    const fn = new Function('created', 'QA_BASE', 'installQaStudentParentBoundary', 'attachStrictBrowserGuards', 'seedBrowserAuth', 'gotoAndSettle', 'emitHomeworkFlowFailure',
      `${extract(spec, 'async function verifyHomeworkFeedback(', '\nasync function waitForHomeworkSummary(')}; return verifyHomeworkFeedback;`)(
      { lectureId: 987654, sessionId: 987654 }, 'https://private.invalid', async () => ({}), () => ({}), async () => {},
      async () => { throw primary; }, (error, checkpoint) => {
        order.push('primary');
        if (loggingFails) emitter(error, checkpoint, () => { throw new Error('logger-secret'); });
        else emit(error, checkpoint);
      });
    await assert.rejects(fn(parent, {}, { access: 'secret-token' }, 'private-user'), error => error === teardown);
    assert.deepEqual(order, ['primary', 'cleanup']);
    assert.deepEqual(logs[0].releaseHomeworkFlowFailure, { schema: 'homework-flow-failure/v1', phase: 'feedback-setup', viewport: null, threshold: null, kind: 'assertion' });
    assertPrivate(logs);
    cases.push('actual-feedback-primary-before-cleanup');
    cleanupFails = false;
    loggingFails = true;
    order.length = 0;
    logs.length = 0;
    await assert.rejects(fn(parent, {}, { access: 'secret-token' }, 'private-user'), error => error === primary);
    assert.deepEqual(order, ['primary', 'cleanup']);
    assert.deepEqual(logs, []);
    cases.push('actual-feedback-logger-fault-preserves-primary');
  }

  const noExpect = () => new Proxy({}, { get: (_target, key) => key === 'not' ? noExpect() : async () => {} });
  const info = { outputPath: name => name, attach: async () => {} };
  const test = { info: () => info };
  const scenario = { lectureId: 1, sessionId: 2, enrollmentId: 3, homeworkId: 4, homeworkTitle: 'private-user',
    completionHomeworkId: 5, completionTitle: 'private-user', completionScore: 1, studentName: 'private-user', studentId: 6,
    comparisonStudent: { id: 7, name: 'private-user', enrollmentId: 8, score: 60, completionScore: 0 } };
  const scoreRows = { rows: [3, 8].map(enrollment_id => ({ enrollment_id, homeworks: [4, 5].map(homework_id => ({ homework_id, block: {} })) })) };
  for (const stage of ['criteria-save', 'criteria-reload', 'criteria-api', 'criteria-parent', 'criteria-preview']) {
    const { logs, emit } = logsFor();
    let reloaded = false;
    const locator = label => ({
      getByRole: (_role, options) => locator(options?.name), getByLabel: name => locator(name), locator: () => locator('nested'),
      filter: () => locator('filtered'), getByText: () => locator('text'),
      fill: async () => {}, click: async () => { if (stage === 'criteria-save' && label === '운영 설정 저장') throw primary; },
    });
    const page = { ...locator('page'), waitForResponse: () => Promise.resolve({ status: () => 200 }),
      reload: async () => { if (stage === 'criteria-reload') throw primary; reloaded = true; }, screenshot: async () => {} };
    const parent = { ...locator('parent'), setViewportSize: async () => { if (stage === 'criteria-parent') throw primary; } };
    const expectApi = async (_request, _method, path) => {
      if (stage === 'criteria-api' && reloaded && path === '/homeworks/4/') throw primary;
      return path.endsWith('/scores/') ? scoreRows : {};
    };
    const fn = new Function('expect', 'test', 'QA_BASE', 'expectApi', 'gotoAndSettle', 'assertNoHorizontalOverflow', 'reloadStudentApp', 'verifyFinalHomeworkPreview', 'emitHomeworkFlowFailure',
      `${extract(helper, 'export async function verifyHomeworkCriteria(')}; return verifyHomeworkCriteria;`)(
      noExpect, test, 'https://private.invalid', expectApi,
      async (_page, url) => { if (stage === 'criteria-preview' && url.endsWith('/scores')) throw primary; },
      async () => {}, async () => {}, async () => {}, emit);
    await assert.rejects(fn(page, parent, {}, 'secret-token', scenario, 1366), error => error === primary);
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0].releaseHomeworkFlowFailure, { schema: 'homework-flow-failure/v1', phase: stage, viewport: 1366, threshold: 95, kind: 'assertion' });
    assertPrivate(logs);
    cases.push(`actual-${stage}`);
  }

  // Execute the real preview catch/finally path. The no-send route is still
  // installed and removed when a preflight error is followed by a write failure.
  {
    const { logs, emit } = logsFor();
    const order = [];
    const locator = label => ({
      getByRole: (_role, options) => locator(options?.name), getByLabel: name => locator(name), locator: () => locator('nested'),
      check: async () => {}, uncheck: async () => {}, fill: async () => {},
      click: async () => { if (label === 'private-user 넣기' && ++insertClicks === 2) throw primary; },
    });
    let insertClicks = 0;
    const page = { ...locator('page'),
      route: async name => { assert.equal(name, '**/api/v1/messaging/send/'); order.push('route'); },
      unroute: async () => order.push('unroute'), waitForResponse: () => Promise.resolve({}) };
    const fn = new Function('expect', 'test', 'writeFile', 'emitHomeworkFlowFailure',
      `${extract(helper, 'async function verifyFinalHomeworkPreview(', '\n/** Reuse only')}; return verifyFinalHomeworkPreview;`)(
      noExpect, test, async () => { order.push('cleanup'); throw teardown; }, (error, checkpoint) => { order.push('primary'); emit(error, checkpoint); });
    await assert.rejects(fn(page, scenario, 390, { threshold: 95 }, 'PASS', 'FAIL'), error => error === teardown);
    assert.deepEqual(order, ['route', 'primary', 'cleanup', 'unroute']);
    assert.deepEqual(logs[0].releaseHomeworkFlowFailure, { schema: 'homework-flow-failure/v1', phase: 'preview-preflight', viewport: 390, threshold: 95, kind: 'assertion' });
    assertPrivate(logs);
    cases.push('actual-preview-primary-before-cleanup-and-unroute');
  }

  // Reach the actual final-preview assertion through valid preflight and distinct
  // student bodies, then make evidence persistence fail as a second error.
  {
    const { logs, emit } = logsFor();
    const order = [];
    const finalScenario = { ...scenario, homeworkTitle: 'private-assignment', completionTitle: 'private-completion',
      studentName: 'private-user-one', comparisonStudent: { ...scenario.comparisonStudent, name: 'private-user-two' } };
    const bodies = [
      'private-user-one\nprivate-assignment: 92/100 (92%) · FAIL\nprivate-completion: 통과',
      'private-user-two\nprivate-assignment: 60/100 (60%) · FAIL\nprivate-completion: 미통과',
    ];
    const preflight = { ok: true, can_send: true, send_to: 'parent', blockers: [],
      recipient: { selected: 2, resolved: 2, valid_phone: 2, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 2, invalid_or_deleted: 0 },
      preview_recipients: [finalScenario, finalScenario.comparisonStudent].map((student, index) => ({
        student_id: index === 0 ? student.studentId : student.id,
        student_name: index === 0 ? student.studentName : student.name,
        excluded: false, full_message_body: bodies[index],
      })) };
    const payload = { send_to: 'parent', student_ids: [6, 7], raw_body: '390px 기준 95 과제별 판정 확인\n#{과제4결과}\n#{과제5결과}' };
    const response = { status: () => 200, json: async () => preflight,
      url: () => 'https://local.invalid/api/v1/messaging/send/preflight/',
      request: () => ({ method: () => 'POST', postDataJSON: () => payload }) };
    let confirmVisible = false, studentsExpanded = false, selectedStudent = null;
    let preflightVerified = false, recipientChecks = 0, bodyChecks = 0;
    const locator = (kind, label = '') => ({ kind, label,
      getByRole: (role, options) => locator(role, options?.name ?? ''),
      getByLabel: name => locator(name === '카카오톡 실제 발송 미리보기' ? 'final-container' : 'inline', name),
      locator: selector => locator(kind === 'final-container' ? 'final-body' : selector),
      filter: ({ hasText }) => locator('student-radio', hasText),
      innerText: async () => bodies[0],
      check: async () => {}, uncheck: async () => {}, fill: async () => {},
      click: async () => {
        if (kind === '.send-modal__send-btn') confirmVisible = true;
        if (label === '전체 학생 열기') studentsExpanded = true;
        if (kind === 'student-radio') selectedStudent = label;
      },
    });
    const page = { ...locator('page'),
      route: async name => { assert.equal(name, '**/api/v1/messaging/send/'); order.push('route'); },
      unroute: async () => order.push('unroute'),
      waitForResponse: predicate => { assert.equal(predicate(response), true); return Promise.resolve(response); } };
    const matchSubset = (actual, expected) => {
      for (const [key, value] of Object.entries(expected)) {
        if (value && typeof value === 'object') matchSubset(actual[key], value);
        else assert.equal(actual[key], value);
      }
    };
    const checkedExpect = (actual, negate = false) => ({
      get not() { return checkedExpect(actual, true); },
      toBe: expected => assert.equal(actual, expected),
      toEqual: expected => assert.deepEqual(actual, expected),
      toMatchObject: expected => {
        matchSubset(actual, expected);
        if (actual === preflight) preflightVerified = true;
        if (preflight.preview_recipients.includes(actual)) recipientChecks++;
      },
      toContain: expected => { assert.equal(actual.includes(expected), !negate); bodyChecks++; },
      toContainText: async expected => assert.ok((await actual.innerText()).includes(expected)),
      toBeVisible: async () => { if (actual.label === '보내기 전 마지막 확인') assert.equal(confirmVisible, true); },
      toBeInViewport: async () => {}, toBeEnabled: async () => {},
      toHaveCount: async expected => { assert.equal(studentsExpanded, true); assert.equal(expected, 2); },
      toHaveAttribute: async (name, expected) => { assert.equal(name, 'aria-checked'); assert.equal(expected, 'true'); assert.equal(selectedStudent, actual.label); },
      toHaveText: async expected => {
        assert.equal(actual.kind, 'final-body');
        assert.equal(expected, bodies[0]);
        assert.equal(preflightVerified, true);
        assert.equal(recipientChecks, 2);
        assert.equal(bodyChecks, 10);
        order.push('final-assert');
        throw primary;
      },
    });
    const fn = new Function('expect', 'test', 'writeFile', 'assertNoHorizontalOverflow', 'emitHomeworkFlowFailure',
      `${extract(helper, 'async function verifyFinalHomeworkPreview(', '\n/** Reuse only')}; return verifyFinalHomeworkPreview;`)(
      checkedExpect, test, async () => { order.push('cleanup'); throw teardown; }, async () => {},
      (error, checkpoint) => { order.push('primary'); emit(error, checkpoint); });
    await assert.rejects(fn(page, finalScenario, 390, { threshold: 95, passed: false }, 'PASS', 'FAIL'), error => error === teardown);
    assert.deepEqual(order, ['route', 'final-assert', 'primary', 'cleanup', 'unroute']);
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0].releaseHomeworkFlowFailure, { schema: 'homework-flow-failure/v1', phase: 'preview-final', viewport: 390, threshold: 95, kind: 'assertion' });
    assertPrivate(logs);
    cases.push('actual-preview-final-after-valid-preflight-primary-before-cleanup-and-unroute');
  }

  assert.equal(cases.length, 15);
});

test("actual workflow producer phases and transport kinds survive the official decoder", () => {
  const learningSource = read("e2e/helpers/attendanceExcelRealuse.ts");
  const homeworkSource = read("e2e/helpers/homeworkCriteriaRealuse.ts");
  const learningBody = learningSource.slice(learningSource.indexOf("const LEARNING_FLOW_PHASES"), learningSource.indexOf("type ExportStudent"));
  const homeworkBody = homeworkSource.slice(homeworkSource.indexOf("export function emitHomeworkFlowFailure("), homeworkSource.indexOf("\ntype CriteriaScenario"));
  const learning = stripTypeScriptTypes(learningBody).replace(/^export /gm, "");
  const homework = stripTypeScriptTypes(homeworkBody).replace(/^export /gm, "");
  const phases = [...homeworkSource.slice(homeworkSource.indexOf("export type HomeworkFlowFailurePhase"), homeworkSource.indexOf("export type HomeworkFlowCheckpoint")).matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(phases).size, 20);
  const output = [];
  const learningApi = new Function("safeNativeTransportKind", "console", learning + "; return { phases: LEARNING_FLOW_PHASES, emit: emitLearningFlowFailure };")(
    policyModule.safeNativeTransportKind, { info: value => output.push(JSON.parse(value)) });
  const homeworkEmit = new Function("safeNativeTransportKind", homework + "; return emitHomeworkFlowFailure;")(policyModule.safeNativeTransportKind);
  assert.equal(new Set(learningApi.phases).size, 14);
  const kinds = [
    ["boundary", new Error("Release request rejected PRIVATE")],
    ["assertion", new Error("expect(PRIVATE) failed")],
    ["locator-timeout", new Error("locator.click: Timeout PRIVATE")],
    ["transport", new Error("socket hang up")],
    ["other", new Error("PRIVATE")],
  ];
  for (const [kind, error] of kinds) {
    for (const phase of learningApi.phases) {
      output.length = 0;
      learningApi.emit(error, phase, phase === "teacher-thumbnail" ? null : 390);
      assert.equal(output[0].releaseLearningFlowFailure.kind, kind);
      assertDecoded(output, "releaseLearningFlowFailure", "learningFlowFailures", "student-parent-learning-realuse.spec.ts");
    }
    for (const phase of phases) {
      for (const viewport of phase === "feedback-setup" ? [null] : [390, 1366]) {
        const thresholds = phase.startsWith("feedback-") || phase === "criteria-setup" ? [null]
          : phase === "criteria-invalid-input" ? [95] : [95, 90];
        for (const threshold of thresholds) {
          output.length = 0;
          homeworkEmit(error, { phase, viewport, threshold }, value => output.push(value));
          assert.equal(output[0].releaseHomeworkFlowFailure.kind, kind);
          assertDecoded(output, "releaseHomeworkFlowFailure", "homeworkFlowFailures", "student-parent-homework-realuse.spec.ts");
        }
      }
    }
  }
});
