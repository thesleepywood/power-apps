import type { KycStatus, RiskLevel } from './types';

/** Fictional sample data. SSNs use the 9xx range, which is never issued. */
export interface SeedCase {
  id: string;
  customerName: string;
  ssn: string;
  risk: RiskLevel;
  reviewReason: string;
  summary: string;
  openedBy: string;
  /** Hours before "now" the case was opened. */
  openedHoursAgo: number;
  escalated?: { by: string; hoursAgo: number; note?: string };
  outcome?: { status: Exclude<KycStatus, 'pending' | 'waiting'>; by: string; hoursAgo: number; note?: string };
}

export const SEED_CASES: SeedCase[] = [
  {
    id: 'KYC-1001',
    customerName: 'Marcus Bell',
    ssn: '943-21-8870',
    risk: 'high',
    reviewReason: 'Name is a close match to a sanctions watchlist entry',
    summary: 'Screening flagged a 92% name match against a consolidated sanctions list. Date of birth differs by 11 years; nationality matches.',
    openedBy: 'u-diego',
    openedHoursAgo: 5,
  },
  {
    id: 'KYC-1002',
    customerName: 'Hana Sato',
    ssn: '918-44-2093',
    risk: 'low',
    reviewReason: "Address on ID doesn't match the application",
    summary: 'Driver license shows a prior address. Customer uploaded a lease dated last month for the new address.',
    openedBy: 'u-diego',
    openedHoursAgo: 2,
  },
  {
    id: 'KYC-1003',
    customerName: 'Olivia Grant',
    ssn: '927-60-3315',
    risk: 'low',
    reviewReason: 'Selfie match score below threshold (0.81)',
    summary: 'Selfie was taken in low light. Second selfie scored 0.88; passport photo is nine years old.',
    openedBy: 'u-priya',
    openedHoursAgo: 26,
  },
  {
    id: 'KYC-1004',
    customerName: 'Rafael Mendes',
    ssn: '936-17-5528',
    risk: 'low',
    reviewReason: 'ID document expired three weeks ago',
    summary: 'Customer has a renewal receipt from the state DMV and a valid passport on file.',
    openedBy: 'u-maya',
    openedHoursAgo: 30,
  },
  {
    id: 'KYC-1005',
    customerName: 'Ngozi Adeyemi',
    ssn: '952-08-7746',
    risk: 'high',
    reviewReason: 'Large incoming wires from a high-risk jurisdiction',
    summary: 'Three wires totaling $84,000 in 10 days from an exchange house abroad. Customer says it is the proceeds of a property sale; deed of sale provided.',
    openedBy: 'u-priya',
    openedHoursAgo: 48,
    escalated: { by: 'u-diego', hoursAgo: 20, note: 'Deed and bank letter check out. Needs Approver sign-off.' },
  },
  {
    id: 'KYC-1006',
    customerName: 'Leo Fischer',
    ssn: '961-35-1182',
    risk: 'low',
    reviewReason: 'Middle name missing on application',
    summary: 'Passport lists a middle name the customer left off the sign-up form.',
    openedBy: 'u-diego',
    openedHoursAgo: 72,
    outcome: { status: 'approved', by: 'u-maya', hoursAgo: 70, note: 'Same person, same DOB. Added middle name.' },
  },
  {
    id: 'KYC-1007',
    customerName: 'Sofia Petrova',
    ssn: '974-52-6609',
    risk: 'low',
    reviewReason: 'Document image looks edited',
    summary: 'Fonts on the date-of-birth line differ from the rest of the card. Customer did not respond to a request for a new photo.',
    openedBy: 'u-maya',
    openedHoursAgo: 96,
    outcome: { status: 'rejected', by: 'u-samuel', hoursAgo: 90, note: 'Altered document. Closing the application.' },
  },
  {
    id: 'KYC-1008',
    customerName: 'Ethan Park',
    ssn: '983-27-4451',
    risk: 'low',
    reviewReason: 'Phone number registered to another customer',
    summary: 'Number previously belonged to a closed account. Carrier confirms it was reassigned in March.',
    openedBy: 'u-samuel',
    openedHoursAgo: 54,
    outcome: { status: 'approved', by: 'u-priya', hoursAgo: 50 },
  },
  {
    id: 'KYC-1009',
    customerName: 'Isabel Cruz',
    ssn: '995-63-0374',
    risk: 'low',
    reviewReason: 'Same device used for two sign-ups',
    summary: 'A second application from the same device belongs to her spouse; different SSN, same household address.',
    openedBy: 'u-samuel',
    openedHoursAgo: 9,
  },
  {
    id: 'KYC-1010',
    customerName: 'Arjun Mehta',
    ssn: '909-14-8823',
    risk: 'low',
    reviewReason: 'Business registration not found',
    summary: 'Sole-proprietor account. The registration number given does not exist in the state registry.',
    openedBy: 'u-priya',
    openedHoursAgo: 120,
    outcome: { status: 'rejected', by: 'u-diego', hoursAgo: 116, note: 'No registration on record; customer stopped responding.' },
  },
];
