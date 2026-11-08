/** Fictional sample data: 10 refunds of $5–$2,000. Amounts are in cents. */
export interface SeedRefund {
  id: string;
  customer: string;
  amountCents: number;
  reason: string;
  summary: string;
  requestedBy: string;
  /** Hours before "now" the refund was requested. */
  requestedHoursAgo: number;
  /** Only for refunds over the auto-approval limit: an Approver's decision. */
  outcome?: { status: 'approved' | 'rejected'; by: string; hoursAgo: number; note?: string };
}

export const SEED_REFUNDS: SeedRefund[] = [
  {
    id: 'RF-2001',
    customer: 'Northwind Coffee Co.',
    amountCents: 185_000,
    reason: 'Duplicate card charge',
    summary: 'Merchant terminal retried a timed-out payment and settled it twice. Processor confirms both captures.',
    requestedBy: 'u-priya',
    requestedHoursAgo: 3,
  },
  {
    id: 'RF-2002',
    customer: 'Amara Okonkwo',
    amountCents: 124_000,
    reason: 'Item returned within 30 days',
    summary: 'Customer returned a laptop within the 30-day window. Warehouse receipt attached; she asked for a refund instead of filing a dispute.',
    requestedBy: 'u-maya',
    requestedHoursAgo: 6,
  },
  {
    id: 'RF-2003',
    customer: 'Bluebird Florists',
    amountCents: 149_999,
    reason: 'Wrong plan billed',
    summary: 'Upgraded to the annual plan by mistake during onboarding. Downgrade done; refunding the difference.',
    requestedBy: 'u-diego',
    requestedHoursAgo: 26,
  },
  {
    id: 'RF-2004',
    customer: 'Tomás Herrera',
    amountCents: 110_000,
    reason: 'Wire fee charged on a waived account',
    summary: 'Premier account holders have wire fees waived. Eleven wires were charged after a fee-schedule migration.',
    requestedBy: 'u-samuel',
    requestedHoursAgo: 50,
    outcome: { status: 'approved', by: 'u-priya', hoursAgo: 47, note: 'Confirmed against the fee schedule.' },
  },
  {
    id: 'RF-2005',
    customer: 'Kestrel Logistics LLC',
    amountCents: 200_000,
    reason: 'Service outage credit',
    summary: 'Asked for a full month refund after a 40-minute payouts delay. SLA credit is 10% of the monthly fee.',
    requestedBy: 'u-diego',
    requestedHoursAgo: 72,
    outcome: { status: 'rejected', by: 'u-samuel', hoursAgo: 69, note: 'Outside the SLA. Offer the 10% credit instead.' },
  },
  {
    id: 'RF-2006',
    customer: 'Jun Watanabe',
    amountCents: 500,
    reason: 'Card replacement fee charged twice',
    summary: 'Replacement card fee was posted twice on the same day.',
    requestedBy: 'u-maya',
    requestedHoursAgo: 1,
  },
  {
    id: 'RF-2007',
    customer: 'Lena Schulz',
    amountCents: 8_940,
    reason: 'Foreign transaction fee on a domestic purchase',
    summary: 'Merchant is US-based but routes through an overseas acquirer. Fee refunded as a courtesy.',
    requestedBy: 'u-diego',
    requestedHoursAgo: 8,
  },
  {
    id: 'RF-2008',
    customer: 'Harbor & Pine Dental',
    amountCents: 100_000,
    reason: 'Cancelled subscription still billed',
    summary: 'Cancellation was submitted before the renewal date but the job ran anyway. Exactly at the auto-approval limit.',
    requestedBy: 'u-priya',
    requestedHoursAgo: 30,
  },
  {
    id: 'RF-2009',
    customer: 'Daniel Osei',
    amountCents: 31_275,
    reason: 'Overdraft fee during a bank holiday',
    summary: 'Paycheck deposit was delayed by the holiday; the overdraft cleared the next business day.',
    requestedBy: 'u-maya',
    requestedHoursAgo: 54,
  },
  {
    id: 'RF-2010',
    customer: 'Copperline Studios',
    amountCents: 172_500,
    reason: 'Customer says the invoice was never authorized',
    summary: 'Invoice was approved in-app by an admin on their account. Audit trail shows their own login and 2FA.',
    requestedBy: 'u-samuel',
    requestedHoursAgo: 96,
    outcome: { status: 'rejected', by: 'u-priya', hoursAgo: 90, note: 'Authorized by their own admin. Not a billing error.' },
  },
];
