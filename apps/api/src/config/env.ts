/**
 * Typed, validated configuration from environment variables. Loaded once at
 * startup; the app refuses to boot if a required value is missing or malformed.
 */

export type GroupCreation = 'open' | 'allowlist' | 'admins';

export interface RateLimits {
  signinPerEmail: number;
  signinPerIp: number;
  codeAttempts: number;
  groupsPerAccount: number;
  invitesPerAccount: number;
  resendsPerParticipant: number;
  messagesPerParticipant: number;
  membersPerGroup: number;
}

export interface AppConfig {
  appUrl: string;
  databaseUrl: string;
  encryptionKey: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };
  mailFrom: string;
  groupCreation: GroupCreation;
  groupCreationAllowlist: string[];
  instanceAdmins: string[];
  instanceName: string;
  defaultLanguage: string;
  privacyPagePath: string | null;
  inactiveGroupYears: number;
  trustProxy: boolean;
  port: number;
  rateLimits: RateLimits;
}

export const CONFIG = Symbol('CONFIG');

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return v;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

function int(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function emails(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const groupCreation = (env.GROUP_CREATION ?? 'admins') as GroupCreation;
  if (!['open', 'allowlist', 'admins'].includes(groupCreation)) {
    throw new Error(`GROUP_CREATION must be open, allowlist or admins`);
  }

  return {
    appUrl: required(env, 'APP_URL').replace(/\/$/, ''),
    databaseUrl: required(env, 'DATABASE_URL'),
    encryptionKey: required(env, 'ENCRYPTION_KEY'),
    // SMTP is optional: with no host the app runs in "log-only" mail mode,
    // which is handy in development. A real instance must set it (see README).
    smtp: {
      host: env.SMTP_HOST ?? '',
      port: int(env.SMTP_PORT, 587),
      user: env.SMTP_USER ?? '',
      password: env.SMTP_PASSWORD ?? '',
      secure: bool(env.SMTP_SECURE, false),
    },
    mailFrom: env.MAIL_FROM ?? 'Santa <santa@localhost>',
    groupCreation,
    groupCreationAllowlist: emails(env.GROUP_CREATION_ALLOWLIST),
    instanceAdmins: emails(env.INSTANCE_ADMINS),
    instanceName: env.INSTANCE_NAME ?? 'Santa',
    defaultLanguage: env.DEFAULT_LANGUAGE ?? 'en',
    privacyPagePath: env.PRIVACY_PAGE_PATH || null,
    inactiveGroupYears: int(env.INACTIVE_GROUP_YEARS, 3),
    trustProxy: bool(env.TRUST_PROXY, false),
    port: int(env.PORT, 3000),
    rateLimits: {
      signinPerEmail: int(env.RATE_LIMIT_SIGNIN_PER_EMAIL, 5),
      signinPerIp: int(env.RATE_LIMIT_SIGNIN_PER_IP, 20),
      codeAttempts: int(env.RATE_LIMIT_CODE_ATTEMPTS, 5),
      groupsPerAccount: int(env.RATE_LIMIT_GROUPS_PER_ACCOUNT, 3),
      invitesPerAccount: int(env.RATE_LIMIT_INVITES_PER_ACCOUNT, 50),
      resendsPerParticipant: int(env.RATE_LIMIT_RESENDS_PER_PARTICIPANT, 1),
      messagesPerParticipant: int(env.RATE_LIMIT_MESSAGES_PER_PARTICIPANT, 20),
      membersPerGroup: int(env.RATE_LIMIT_MEMBERS_PER_GROUP, 50),
    },
  };
}
