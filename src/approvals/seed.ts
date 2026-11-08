import type { RequestKind } from './types';

/** Fictional sample data. SSNs use the 9xx range, which is never issued. */
export interface SeedRequest {
  id: string;
  kind: RequestKind;
  title: string;
  customerName: string;
  customerSsn: string;
  amount: number | null;
  reason: string;
  summary: string;
  requestedBy: string;
  /** Hours before "now" the request was opened. */
  openedHoursAgo: number;
  outcome?: { status: 'approved' | 'rejected' | 'withdrawn'; by: string; hoursAgo: number; note?: string };
}

export const SEED_REQUESTS: SeedRequest[] = [
  {
    id: 'APR-1001',
    kind: 'Limit increase',
    title: 'Raise daily ACH limit to $50,000',
    customerName: 'Elena Marsh',
    customerSsn: '921-55-4401',
    amount: 50000,
    reason: 'Seasonal volume — holiday catering orders',
    summary: 'Juniper & Vine Coffee has paid on time for 26 months. Owner expects payroll and supplier runs to triple through January.',
    requestedBy: 'u-maya',
    openedHoursAgo: 3,
  },
  {
    id: 'APR-1002',
    kind: 'Fee waiver',
    title: 'Waive two overdraft fees',
    customerName: 'Tomás Rivera',
    customerSsn: '934-12-7788',
    amount: 70,
    reason: 'Fees caused by a delayed payroll deposit on our side',
    summary: 'Employer deposit was held for review for 2 business days, triggering two $35 overdraft fees.',
    requestedBy: 'u-diego',
    openedHoursAgo: 52,
    outcome: { status: 'approved', by: 'u-priya', hoursAgo: 49, note: 'Our hold, our fee. Approved.' },
  },
  {
    id: 'APR-1003',
    kind: 'Manual payout',
    title: 'Release held settlement to Harbor Lane Dental',
    customerName: 'Amina Yusuf',
    customerSsn: '948-30-2219',
    amount: 1840.5,
    reason: 'Settlement stuck after bank account change',
    summary: 'Payout failed twice after the practice switched banks. New account verified by micro-deposits on Tuesday.',
    requestedBy: 'u-priya',
    openedHoursAgo: 6,
  },
  {
    id: 'APR-1004',
    kind: 'Account reopen',
    title: 'Reopen closed checking account',
    customerName: 'Jonah Whitfield',
    customerSsn: '957-81-0043',
    amount: null,
    reason: 'Customer asked to reopen after moving back',
    summary: 'Account closed 14 months ago with a negative balance that was charged off.',
    requestedBy: 'u-maya',
    openedHoursAgo: 75,
    outcome: { status: 'rejected', by: 'u-samuel', hoursAgo: 70, note: 'Outstanding charge-off must be settled first.' },
  },
  {
    id: 'APR-1005',
    kind: 'Profile override',
    title: 'Override address verification mismatch',
    customerName: 'Ruth Okonkwo',
    customerSsn: '963-47-5512',
    amount: null,
    reason: 'New-build address not yet in USPS database',
    summary: 'Customer provided a utility bill and lease for the new address. Automated check keeps failing.',
    requestedBy: 'u-diego',
    openedHoursAgo: 20,
  },
  {
    id: 'APR-1006',
    kind: 'Limit increase',
    title: 'Raise card spend limit to $15,000',
    customerName: 'Kenji Watanabe',
    customerSsn: '972-66-3190',
    amount: 15000,
    reason: 'Business travel season',
    summary: 'Consistent payment history, utilization under 20% for the past year.',
    requestedBy: 'u-samuel',
    openedHoursAgo: 98,
    outcome: { status: 'approved', by: 'u-priya', hoursAgo: 96 },
  },
  {
    id: 'APR-1007',
    kind: 'Fee waiver',
    title: 'Waive wire recall fees',
    customerName: 'Lucia Romero',
    customerSsn: '985-20-6634',
    amount: 120,
    reason: 'Wire sent to wrong beneficiary',
    summary: 'Customer typo on the beneficiary account. Recall succeeded.',
    requestedBy: 'u-maya',
    openedHoursAgo: 30,
    outcome: { status: 'withdrawn', by: 'u-maya', hoursAgo: 28 },
  },
  {
    id: 'APR-1008',
    kind: 'Write-off',
    title: 'Write off disputed chargeback balance',
    customerName: 'Owen Brooks',
    customerSsn: '991-08-4427',
    amount: 642.18,
    reason: 'Merchant closed; dispute unrecoverable',
    summary: 'Card network ruled for the cardholder after the merchant went out of business. Balance cannot be recovered.',
    requestedBy: 'u-diego',
    openedHoursAgo: 9,
  },
];
