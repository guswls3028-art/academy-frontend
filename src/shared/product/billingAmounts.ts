export type BillingAmountSource = {
  monthly_price: number;
  monthly_supply_amount?: number;
  monthly_tax_amount?: number;
  monthly_total_amount?: number;
  vat_rate_percent?: number;
  monthly_price_includes_tax?: boolean;
};

export type BillingAmounts = {
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  vatRatePercent: number;
};

/**
 * Resolve the explicit billing amount contract while remaining safe during a
 * rolling deploy against the legacy monthly_price-only response.
 */
export function resolveBillingAmounts(source: BillingAmountSource): BillingAmounts {
  const vatRatePercent = source.vat_rate_percent ?? 10;
  const legacyPrice = source.monthly_price;

  if (source.monthly_price_includes_tax) {
    const totalAmount = source.monthly_total_amount ?? legacyPrice;
    const supplyAmount = source.monthly_supply_amount
      ?? Math.round(totalAmount / (1 + vatRatePercent / 100));
    const taxAmount = source.monthly_tax_amount ?? totalAmount - supplyAmount;
    return { supplyAmount, taxAmount, totalAmount, vatRatePercent };
  }

  const supplyAmount = source.monthly_supply_amount ?? legacyPrice;
  const taxAmount = source.monthly_tax_amount
    ?? Math.floor(supplyAmount * vatRatePercent / 100);
  const totalAmount = source.monthly_total_amount ?? supplyAmount + taxAmount;
  return { supplyAmount, taxAmount, totalAmount, vatRatePercent };
}
