import assert from "node:assert/strict";
import {test} from "node:test";
import {examCohort} from "../src/shared/product/dawon/adminExamCohort.ts";

const roster = [
  ["가람고",1,0,100,"채점 완료"], ["가람고",1,40,50,"채점 완료"], ["가람고",1,null,null,"미응시"],
  ["",null,12,20,"채점 완료"], ["",null,null,null,"채점 대기"], ["가람고",2,7,0,"채점 완료"],
].map(([school,grade,score,maximum,status],i)=>({id:i+1,student_id:i+1,name:"학생 "+(i+1),school,grade,score,maximum,status}));
const run = (params={}) => examCohort(roster,new URLSearchParams(params),30);
test("counts, raw scores, and rate distribution use the same intersected exam cohort",()=>{
  const all=run();
  assert.deepEqual([all.rows.length,all.count,all.average,all.highest,all.lowest],[6,4,14.75,40,0]);
  assert.deepEqual(all.distribution,[1,0,0,1,1]);
  const school={examSchool:"school:가람고",examGrade:"1"};
  const cohort=run(school);
  assert.deepEqual([cohort.rows.length,cohort.count,cohort.average,cohort.highest,cohort.lowest],[3,2,20,40,0]);
  assert.deepEqual(cohort.distribution,[1,0,0,0,1]);
  for(const examBand of ["4","top"]) assert.deepEqual(run({...school,examState:"채점 완료",examBand}).rows.map(r=>r.id),[2]);
});
test("missing demographics, pending results, exact boundaries, and empty intersections",()=>{
  const unknown=run({examSchool:"missing",examGrade:"missing"});
  assert.deepEqual(unknown.rows.map(r=>r.id),[4,5]);
  assert.equal(unknown.average,12);
  for(const examState of ["미응시","채점 대기","존재하지 않음"]){
    const group=run({examState});
    assert.equal(group.count,0);
    assert.equal(group.average,null);
    assert.deepEqual(group.distribution,[0,0,0,0,0]);
  }
  const boundaries=[0,19,20,40,60,80,100].map((score,i)=>({...roster[0],id:i+1,score,maximum:100}));
  assert.deepEqual(examCohort(boundaries,new URLSearchParams()).distribution,[2,1,1,1,2]);
  assert.equal(examCohort(boundaries,new URLSearchParams("examBand=top"),30).rows.length,3);
});

test("question rates follow the selected enrollments and exclude missing marks", async () => {
  const {questionRates} = await import("../src/shared/product/dawon/adminExamCohort.ts");
  const questions = [{number:1,topic:"함수",graded_ids:[1,2,3],correct_ids:[1,3]}];
  assert.deepEqual(questionRates(questions,[{id:2},{id:1}])[0],{number:1,topic:"함수",graded:2,rate:50});
  assert.equal(questionRates(questions,[{id:2}])[0].rate,0);
  assert.equal(questionRates(questions,[{id:4}])[0].rate,null);
});
