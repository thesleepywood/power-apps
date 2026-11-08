import type { ComponentType } from 'react';
import { KycCaseRecord } from '../kyc/client/KycCaseRecord';
import { RefundRecord } from '../refunds/client/RefundRecord';

/** How to render a full record for each app, so Home can show any app's record. */
export const RECORD_VIEWS: Record<string, ComponentType<{ id: string; compact?: boolean }>> = {
  kyc: KycCaseRecord,
  refunds: RefundRecord,
};
