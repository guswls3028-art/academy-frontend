import assert from "node:assert/strict";
import test from "node:test";
import { assertDevelopmentHostIam } from "../run-development-release-canary.mjs";

function fixture() {
  const boundary = { Sid: "DenyOutsideDevelopmentParameters", Effect: "Deny", Action: "ssm:GetParameter",
    NotResource: "arn:aws:ssm:ap-northeast-2:809466760795:parameter/academy/api/development/env" };
  const homework = { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: "batch:SubmitJob", Resource: [
    "arn:aws:batch:ap-northeast-2:809466760795:job-queue/academy-development-homework-video-queue",
    "arn:aws:batch:ap-northeast-2:809466760795:job-definition/academy-development-homework-video-*",
  ] }] };
  return { policyNames: ["academy-homework-preview-development", "academy-api-development-runtime"],
    attachedPolicyArns: ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"],
    runtimePolicy: { Statement: [structuredClone(boundary)] }, expectedBoundary: { Statement: [boundary] },
    homeworkPolicy: structuredClone(homework), expectedHomeworkPolicy: homework };
}

test("development IAM accepts the exact owned homework grant while retaining parameter denial", () => {
  assert.doesNotThrow(() => assertDevelopmentHostIam(fixture()));
});

test("development IAM rejects missing, additional and duplicate inline policies", () => {
  for (const names of [["academy-api-development-runtime"], [...fixture().policyNames, "foreign-policy"],
    [...fixture().policyNames, "academy-homework-preview-development"]]) {
    assert.throws(() => assertDevelopmentHostIam({ ...fixture(), policyNames: names }));
  }
});

test("development IAM rejects broader homework actions and production resources", () => {
  for (const mutate of [
    (value) => { value.Statement[0].Action = ["batch:SubmitJob", "batch:TagResource"]; },
    (value) => { value.Statement[0].Resource = ["*"]; },
    (value) => { value.Statement[0].Resource[0] = "arn:aws:batch:ap-northeast-2:809466760795:job-queue/academy-video-queue"; },
    (value) => { value.Statement.push({ Effect: "Allow", Action: "ssm:GetParameter", Resource: "*" }); },
  ]) {
    const input = fixture();
    mutate(input.homeworkPolicy);
    assert.throws(() => assertDevelopmentHostIam(input), /homework SubmitJob policy drift/);
  }
});

test("development IAM still rejects missing parameter denial and broader managed policy", () => {
  const input = fixture();
  input.runtimePolicy.Statement = [];
  assert.throws(() => assertDevelopmentHostIam(input), /parameter deny/);
  assert.throws(() => assertDevelopmentHostIam({ ...fixture(), attachedPolicyArns: ["arn:aws:iam::aws:policy/AdministratorAccess"] }));
});
