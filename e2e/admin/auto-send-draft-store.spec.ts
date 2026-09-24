import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "../fixtures/strictTest";
import type { AutoSendConfigItem } from "../../src/app_admin/domains/messages/api/messages.api";
import {
  clearAutoSendDrafts,
  clearOtherAutoSendDrafts,
  getAutoSendDraft,
} from "../../src/app_admin/domains/messages/hooks/autoSendDraftStore";
import { messageQueryKeys } from "../../src/app_admin/domains/messages/queryKeys";

const config = (delay_value: number) => ({ trigger: "withdrawal_complete", delay_value }) as AutoSendConfigItem;

test("a GET begun during PATCH cannot replace the authoritative PATCH readback", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(messageQueryKeys.autoSend, [config(30)], { updatedAt: Date.now() - 1_000 });
  let finishPatch: ((value: AutoSendConfigItem[]) => void) | undefined;
  let finishGet: ((value: AutoSendConfigItem[]) => void) | undefined;
  const draft = getAutoSendDraft(
    qc, "tenant-a:1", "tenant-a",
    () => new Promise<AutoSendConfigItem[]>((resolve) => { finishPatch = resolve; }),
    () => "tenant-a", () => {},
  );
  const cleanCacheValues: number[] = [];
  draft.subscribe(() => {
    if (!draft.getSnapshot().patches.length) {
      cleanCacheValues.push(qc.getQueryData<AutoSendConfigItem[]>(messageQueryKeys.autoSend)?.[0].delay_value ?? -1);
    }
  });
  draft.edit([{ trigger: "withdrawal_complete", delay_value: 45 }]);
  await expect.poll(() => Boolean(finishPatch)).toBe(true);

  // This query ignores AbortSignal, like a GET that was already in transport.
  const lateGet = qc.fetchQuery({
    queryKey: messageQueryKeys.autoSend,
    queryFn: () => new Promise<AutoSendConfigItem[]>((resolve) => { finishGet = resolve; }),
    staleTime: 0,
  }).catch(() => undefined);
  await expect.poll(() => Boolean(finishGet)).toBe(true);
  finishPatch?.([config(45)]);
  await expect.poll(() => draft.getSnapshot().patches.length).toBe(0);
  finishGet?.([config(30)]);
  await lateGet;
  expect(qc.getQueryData<AutoSendConfigItem[]>(messageQueryKeys.autoSend)?.[0].delay_value).toBe(45);
  expect(cleanCacheValues).toEqual([45]);
  clearAutoSendDrafts(qc);
});

test("logout and tenant switch discard a pending draft before any cross-account PATCH", async () => {
  const qc = new QueryClient();
  let tenant = "tenant-a";
  let patches = 0;
  const save = async () => { patches += 1; return [config(45)]; };
  const currentTenant = () => tenant;

  const logoutDraft = getAutoSendDraft(qc, "tenant-a:1", tenant, save, currentTenant, () => {});
  logoutDraft.edit([{ trigger: "withdrawal_complete", delay_value: 45 }], true);
  clearAutoSendDrafts(qc);
  await new Promise((resolve) => setTimeout(resolve, 650));
  expect(logoutDraft.getSnapshot().patches).toEqual([]);
  expect(patches).toBe(0);

  const oldTenantDraft = getAutoSendDraft(qc, "tenant-a:1", tenant, save, currentTenant, () => {});
  oldTenantDraft.edit([{ trigger: "withdrawal_complete", delay_value: 55 }], true);
  tenant = "tenant-b";
  getAutoSendDraft(qc, "tenant-b:2", tenant, save, currentTenant, () => {});
  clearOtherAutoSendDrafts(qc, "tenant-b:2");
  await new Promise((resolve) => setTimeout(resolve, 650));
  expect(oldTenantDraft.getSnapshot().patches).toEqual([]);
  expect(patches).toBe(0);
  clearAutoSendDrafts(qc);
});
