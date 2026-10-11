/**
 * Security Rules Red Team Verification Suite (Dirty Dozen Payloads)
 * Verifies that all 12 adversarial payloads defined in security_spec.md
 * return PERMISSION_DENIED against firestore.rules.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Applicant Creation',
    collection: 'applicants/SPMB-2027-0001',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { regNumber: 'SPMB-2027-0001', isAdmin: true }
  },
  {
    id: 2,
    name: 'Email Spoofing Attack (email_verified: false)',
    collection: 'school_config/main',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { activeYearLabel: '2029/2030' }
  },
  {
    id: 3,
    name: 'Public Scraping of Applicant PII (list on /applicants)',
    collection: 'applicants',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Public Scraping of Status Lookup (list on /applicant_status_lookup)',
    collection: 'applicant_status_lookup',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Unauthorized Read of Private Student Documents',
    collection: 'applicant_documents/doc_1',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Privilege Escalation in /admins/{uid}',
    collection: 'admins/attacker_uid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid', role: 'Super Admin', isActive: true }
  },
  {
    id: 7,
    name: 'Timestamp Forgery (createdAt backdating)',
    collection: 'applicants/SPMB-2027-0002',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' }
  },
  {
    id: 8,
    name: 'Immutable Field Mutation (regNumber change on update)',
    collection: 'applicants/SPMB-2027-0001',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { regNumber: 'SPMB-2027-9999' }
  },
  {
    id: 9,
    name: 'Resource Poisoning (Oversized ID / String)',
    collection: 'applicants/SPMB-2027-0003',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { fullName: 'A'.repeat(500) }
  },
  {
    id: 10,
    name: 'Value Poisoning on Update (Invalid status enum)',
    collection: 'applicants/SPMB-2027-0001',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { status: 'Lulus Otomatis' }
  },
  {
    id: 11,
    name: 'Audit Log Tampering (delete on /audit_logs)',
    collection: 'audit_logs/log_1',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Unauthorized Academic Year Mutation',
    collection: 'academic_years/2027-2028',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { isActive: false }
  }
];
