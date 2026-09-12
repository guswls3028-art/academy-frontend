import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getApiErrorMessage } from "../../src/shared/api/errorMessage.ts";

const pendingDetail = "목록에서 삭제되었습니다. 원본 파일 정리는 재시도 대기 중입니다. 새로고침으로 목록을 확인해 주세요.";

function readCallback(component, callbackName) {
  const source = ts.createSourceFile(component, fs.readFileSync(new URL(
    `../../src/app_admin/domains/storage/components/${component}.tsx`, import.meta.url,
  ), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (callbackName === "single" && ts.isJsxAttribute(node) && node.name.getText(source) === "onClick") {
      const expression = node.initializer?.expression;
      if (expression && ts.isArrowFunction(expression) && expression.getText(source).includes("await deleteFile(")) {
        matches.push(expression);
      }
    } else if (ts.isVariableDeclaration(node) && node.name.getText(source) === callbackName) {
      matches.push(node.initializer.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(matches.length, 1, `${component}/${callbackName} must select the real callback exactly once`);
  return ts.transpileModule(`const callback = ${matches[0].getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}

function harness(component, callbackName, reply, itemType = "file") {
  const scope = component === "MyStorageExplorer" ? "admin" : "student";
  const inventoryKey = ["inventory", scope];
  const errors = [], successes = [], requests = [], invalidations = [];
  let serverRows = ["301"];
  let renderedRows = [...serverRows];
  let currentFolder = "301";
  let fileActionTarget = { id: "301", matchup: { id: 11 } };
  const remove = async (...args) => {
    requests.push(args);
    if (reply !== "rollback") serverRows = [];
    if (reply !== "success") throw {
      message: "Request failed with status code 502",
      response: { status: 502, data: {
        deleted: reply === "partial",
        detail: reply === "partial" ? pendingDetail : "삭제하지 못했습니다. 다시 시도해 주세요.",
      } },
    };
    return { ok: true, deleted: { folders: 1, files: 1, matchup_docs: 1, r2_objects: 1 } };
  };
  const dependencies = {
    SCOPE: scope, studentPs: "PS-001", QK: inventoryKey,
    fileActionTarget,
    setFileActionTarget: (value) => { fileActionTarget = value; },
    inventoryGuardRef: { current: { ready: true, fence: "current" } },
    confirm: async () => true,
    deleteFile: remove, deleteFolder: remove,
    qc: { getQueryState: () => ({ status: "success", error: null, data: { folders: serverRows.map((id) => ({ id })) } }),
      invalidateQueries({ queryKey }) {
      invalidations.push(queryKey);
      if (queryKey === inventoryKey) renderedRows = [...serverRows];
    } },
    storageQueryKeys: { storageInventory: () => inventoryKey, matchupDocuments: ["matchup"] },
    feedback: { error: (message) => errors.push(message), success: (message) => successes.push(message) },
    getApiErrorMessage,
    computeFolderStats: () => ({ folders: 2, files: 1, matchupCount: 1, totalBytes: 128 }),
    currentFolderId: "301", setCurrentFolderId: (value) => { currentFolder = value; }, clearSelection() {}, setIsDeleting() {},
    selectedFolderIds: new Set(itemType === "folder" ? ["301"] : []),
    selectedFileIds: new Set(itemType === "file" ? ["301"] : []),
    subFiles: [{ id: "301", matchup: { id: 11 } }],
  };
  const callback = new Function(...Object.keys(dependencies), `${readCallback(component, callbackName)}\nreturn callback;`)(
    ...Object.values(dependencies),
  );
  return {
    run: () => callback("301", "폴더"), requests, errors, successes, invalidations, inventoryKey,
    rows: () => renderedRows, folder: () => currentFolder, menu: () => fileActionTarget, guard: dependencies.inventoryGuardRef,
  };
}

for (const component of ["MyStorageExplorer", "StudentStorageExplorer"]) {
  for (const reply of ["success", "partial", "rollback"]) {
    test(`${component} single ${reply}: authoritative reload and exact visible result`, async () => {
      const state = harness(component, "single", reply);
      await state.run();
      assert.equal(state.requests.length, 1);
      assert.equal(state.requests[0][0], component === "MyStorageExplorer" ? "admin" : "student");
      assert.deepEqual(state.rows(), reply === "rollback" ? ["301"] : []);
      assert.ok(state.invalidations.includes(state.inventoryKey));
      if (reply !== "success") {
        assert.deepEqual(state.errors, [reply === "partial" ? pendingDetail : "삭제하지 못했습니다. 다시 시도해 주세요."]);
        assert.deepEqual(state.successes, []);
      }
    });
  }
  test(`${component} single stale confirmation keeps mutation zero`, async () => {
    const state = harness(component, "single", "partial");
    state.guard.current.ready = false;
    await state.run();
    assert.deepEqual(state.requests, []);
    assert.deepEqual(state.invalidations, []);
  });
  for (const itemType of ["file", "folder"]) {
    test(`${component} bulk ${itemType} partial: detail and persisted list, no success toast`, async () => {
      const state = harness(component, "handleDeleteSelected", "partial", itemType);
      await state.run();
      assert.equal(state.requests.length, 1);
      assert.deepEqual(state.rows(), []);
      assert.deepEqual(state.errors, [pendingDetail]);
      assert.deepEqual(state.successes, []);
      assert.equal(state.menu(), null, "completed selection deletion must not reopen the stale file menu");
      if (component === "MyStorageExplorer") assert.ok(state.invalidations.some((key) => key[0] === "matchup"));
    });
  }
}

for (const reply of ["success", "partial", "rollback"]) {
  test(`recursive folder ${reply}: authoritative inventory and matchup projections`, async () => {
    const state = harness("MyStorageExplorer", "handleDeleteFolderRecursive", reply, "folder");
    await state.run();
    assert.equal(state.requests.length, 1);
    assert.deepEqual(state.rows(), reply === "rollback" ? ["301"] : []);
    assert.ok(state.invalidations.includes(state.inventoryKey));
    assert.ok(state.invalidations.some((key) => key[0] === "matchup"));
    assert.equal(state.folder(), reply === "rollback" ? "301" : null);
    if (reply !== "success") {
      assert.deepEqual(state.errors, [reply === "partial" ? pendingDetail : "삭제하지 못했습니다. 다시 시도해 주세요."]);
      assert.deepEqual(state.successes, []);
    }
  });
}
