import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderDawonLearner,learnerCalendarPeriod} from '../../deploy/dawon/dawon-learner-sessions.mjs';

const origin = 'https://demo.hakwonplus.com';

test('family home detail returns to the same role, selected day and calendar view',()=>{
  for(const role of ['student','guardian']){
    assert.match(renderDawonLearner(new URL('/?preview='+role,origin)),/id="dw-home-calendar"/);
    for(const [period,expected] of [['week','week'],['month','month'],['invalid','week'],['','week']]){
      const record=renderDawonLearner(new URL('/learn/attendance?preview='+role+'&view=day&date=2026-11-19&from=home&period='+period,origin));
      assert.ok(record.includes('href="/?preview='+role+'&amp;view='+expected+'&amp;date=2026-11-19#dw-home-calendar"'));
    }
  }
});
test('Sunday-first weeks and monthly movement preserve the selected day across month and year boundaries',()=>{
  assert.deepEqual(learnerCalendarPeriod('2026-12-30','week'),{
    start:'2026-12-27',end:'2027-01-02',count:7,previous:'2026-12-23',next:'2027-01-06',
  });
  assert.deepEqual(learnerCalendarPeriod('2024-01-31','month'),{
    start:'2023-12-31',end:'2024-02-03',count:35,previous:'2023-12-31',next:'2024-02-29',
  });
  assert.equal(learnerCalendarPeriod('2025-03-31','month').previous,'2025-02-28');
  assert.equal(learnerCalendarPeriod('2026-11-19','month',false).next,'2026-12-01');
});

test('both family roles see the identical customer-supplied lesson sequence independently of enrolled sessions',() => {
  const rows=role=>{
    const html=renderDawonLearner(new URL('/learn/curriculum?preview='+role,origin));
    const table=html.match(/<section[^>]+data-customer-progress>([\s\S]*?)<\/section>/)[1];
    return [...table.matchAll(/<th scope="row">(\d+)회차<\/th><td>([^<]+)<\/td>/g)].map(m=>[Number(m[1]),m[2]]);
  };
  const student=rows('student');
  assert.deepEqual(rows('guardian'),student);
  assert.deepEqual(student.map(row=>row[0]),Array.from({length:14},(_,i)=>i+1));
  assert.match(student[4][1],/극심화 문제 풀이 1차$/);
  assert.match(student[8][1],/극심화 문제 풀이 2차$/);
  assert.equal(student[13][1],'12 위치와 속도');
});
