/**
 * Hardened Red-Team Security Specification Tests for BoilerChem Pro Firestore Rules
 * Verifies that all Dirty Dozen attack payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const dirtyDozenTestCases: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Calculation',
    operation: 'create',
    path: '/calculations/calc_01',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { boilerId: 'BOILER_1_2', isVerified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof',
    operation: 'create',
    path: '/chemicals/chem_01',
    auth: { uid: 'spoof_1', email: 'boilerchemical49@gmail.com', email_verified: false },
    payload: { code: 'TCE-2138', divisor: 8 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Calculation Creation',
    operation: 'create',
    path: '/calculations/calc_02',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { authorId: 'user_2', boilerId: 'BOILER_1_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Resource Poisoning via Oversized Note',
    operation: 'create',
    path: '/calculations/calc_03',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { note: 'X'.repeat(1000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Zero Divisor Injection on Chemical',
    operation: 'create',
    path: '/chemicals/chem_02',
    auth: { uid: 'admin_1', email: 'boilerchemical49@gmail.com', email_verified: true },
    payload: { code: 'BAD-CHEM', divisor: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/calculations/calc_04',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immortal Field Mutation on Update',
    operation: 'update',
    path: '/calculations/calc_01',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { authorId: 'hijacked_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal State Bypass After Archived',
    operation: 'update',
    path: '/calculations/calc_archived',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { status: 'recorded', note: 'Reopened illegally' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unauthorized Admin Self-Promotion',
    operation: 'create',
    path: '/admins/user_1',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    payload: { uid: 'user_1', email: 'op@example.com' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'PII Leak via /admins Read by Non-Owner',
    operation: 'get',
    path: '/admins/admin_root',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthenticated List Query on Calculations',
    operation: 'list',
    path: '/calculations',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Path ID Poisoning Attack',
    operation: 'get',
    path: '/calculations/bad$id!@#',
    auth: { uid: 'user_1', email: 'op@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
