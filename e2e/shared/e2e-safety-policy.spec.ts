import { expect, test } from "../fixtures/strictTest";
import {
  PRODUCTION_CONTROLLED_PHONE,
  controlledPhoneForApiUrl,
  nonPrimaryTenantWriteSkipReason,
  productionMultiNoticeFlowSkipReason,
  productionTriggerMutationSkipReason,
  productionUnisolatedScenarioSkipReason,
  realMessagingSkipReason,
} from "../helpers/safety";

test.describe("E2E production safety policy", () => {
  test("production controlled phone cannot be overridden", () => {
    expect(
      controlledPhoneForApiUrl("https://api.hakwonplus.com", "01099998888"),
    ).toBe(PRODUCTION_CONTROLLED_PHONE);
    expect(
      controlledPhoneForApiUrl("http://127.0.0.1:8000", "01099998888"),
    ).toBe("01099998888");
  });

  test("real messaging requires exact opt-in and the production recipient", () => {
    expect(
      realMessagingSkipReason(
        "https://api.hakwonplus.com",
        PRODUCTION_CONTROLLED_PHONE,
        undefined,
      ),
    ).not.toBeNull();
    expect(
      realMessagingSkipReason(
        "https://api.hakwonplus.com",
        "01099998888",
        "1",
      ),
    ).not.toBeNull();
    expect(
      realMessagingSkipReason(
        "https://api.hakwonplus.com",
        PRODUCTION_CONTROLLED_PHONE,
        "1",
      ),
    ).toBeNull();
  });

  test("production blocks existing-record triggers and non-primary writes", () => {
    expect(
      productionTriggerMutationSkipReason("https://api.hakwonplus.com"),
    ).not.toBeNull();
    expect(
      productionTriggerMutationSkipReason("http://127.0.0.1:8000"),
    ).toBeNull();
    expect(
      productionUnisolatedScenarioSkipReason("https://api.hakwonplus.com"),
    ).not.toBeNull();
    expect(
      productionMultiNoticeFlowSkipReason("https://api.hakwonplus.com"),
    ).not.toBeNull();
    expect(
      nonPrimaryTenantWriteSkipReason("dnb", "https://api.hakwonplus.com"),
    ).not.toBeNull();
    expect(
      nonPrimaryTenantWriteSkipReason("dnb", "http://127.0.0.1:8000"),
    ).toBeNull();
  });
});
