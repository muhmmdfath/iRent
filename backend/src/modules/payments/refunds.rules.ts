import { SettingsValues } from '../settings/settings.rules';

/** No-show retains at most the snapshotted DP, without percentage rounding. */
export function noShowShares(amounts: bigint[], dp: bigint) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  const refund = total > dp ? total - dp : 0n;
  const shares = amounts.map((amount) =>
    total > 0n ? (amount * refund) / total : 0n,
  );
  let remainder = refund - shares.reduce((sum, share) => sum + share, 0n);
  for (let index = 0; remainder > 0n && index < shares.length; index++) {
    if (shares[index] < amounts[index]) {
      shares[index]++;
      remainder--;
    }
  }
  return { total, refund, shares };
}

/** Round once on the total, then distribute remainder in stable source order. */
export function refundShares(amounts: bigint[], percent: number) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  const refund = (total * BigInt(percent) + 50n) / 100n;
  const shares = amounts.map((amount) => (amount * BigInt(percent)) / 100n);
  let remainder = refund - shares.reduce((sum, share) => sum + share, 0n);
  for (let index = 0; remainder > 0n && index < shares.length; index++) {
    if (shares[index] < amounts[index]) {
      shares[index]++;
      remainder--;
    }
  }
  return { total, refund, shares };
}

export function cancellationPolicy(
  rules: SettingsValues,
  startAt: Date,
  now: Date,
  applied: bigint,
  bill: bigint,
  shopFailure: boolean,
) {
  const category = applied >= bill && bill > 0n ? 'full' : 'dp';
  const early =
    startAt.getTime() - now.getTime() >
    rules.cancel_refund_cutoff_days * 86400000;
  const percent = shopFailure
    ? 100
    : !early
      ? 0
      : category === 'full'
        ? rules.cancel_full_refund_percent
        : rules.cancel_refund_percent;
  return { category, early, percent };
}
