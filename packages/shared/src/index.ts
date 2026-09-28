/**
 * @crm/shared — single API contract between backend (NestJS) and frontend (Angular).
 *
 * Framework-free: does NOT import Nest, Angular, or class-validator.
 * Kept all in one file so NodeNext ESM doesn't require extensions
 * in relative imports and there are no Node runtime resolution issues.
 *
 * Server-side DTOs with class-validator decorators live in backend/ and aren't duplicated here.
 */

/* ============================ Base types ============================ */

export type UUID = string;
/** ISO-8601, e.g. "2026-09-27T10:00:00.000Z" */
export type ISODateString = string;

export interface BaseEntity {
  id: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/* ============================ Enums ============================ */
// Pattern: const object + same-named union type — works both as a value and as a type,
// without TS enum's runtime quirks, and tree-shakes well.

export const OrganizationMemberStatus = {
  Active: 'active',
  Invited: 'invited',
  Suspended: 'suspended',
} as const;
export type OrganizationMemberStatus =
  (typeof OrganizationMemberStatus)[keyof typeof OrganizationMemberStatus];

export const LeadStatus = {
  New: 'new',
  Contacted: 'contacted',
  Qualified: 'qualified',
  Converted: 'converted',
  Lost: 'lost',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const DealStatus = {
  Open: 'open',
  Won: 'won',
  Lost: 'lost',
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const TaskStatus = {
  Open: 'open',
  InProgress: 'in_progress',
  Done: 'done',
  Canceled: 'canceled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  Low: 'low',
  Normal: 'normal',
  High: 'high',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const NotificationType = {
  TaskAssigned: 'task_assigned',
  TaskDue: 'task_due',
  DealStageChanged: 'deal_stage_changed',
  Mention: 'mention',
  System: 'system',
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const CommentEntityType = {
  Contact: 'contact',
  Company: 'company',
  Lead: 'lead',
  Deal: 'deal',
  Task: 'task',
} as const;
export type CommentEntityType =
  (typeof CommentEntityType)[keyof typeof CommentEntityType];

/* ============================ RBAC: permissions and roles ============================ */

export const PERMISSIONS = {
  CONTACTS_READ: 'contacts.read',
  CONTACTS_CREATE: 'contacts.create',
  CONTACTS_UPDATE: 'contacts.update',
  CONTACTS_DELETE: 'contacts.delete',

  COMPANIES_READ: 'companies.read',
  COMPANIES_CREATE: 'companies.create',
  COMPANIES_UPDATE: 'companies.update',
  COMPANIES_DELETE: 'companies.delete',

  LEADS_READ: 'leads.read',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  LEADS_CONVERT: 'leads.convert',

  DEALS_READ: 'deals.read',
  DEALS_CREATE: 'deals.create',
  DEALS_UPDATE: 'deals.update',
  DEALS_DELETE: 'deals.delete',

  PIPELINES_MANAGE: 'pipelines.manage',

  TASKS_READ: 'tasks.read',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',

  COMMENTS_READ: 'comments.read',
  COMMENTS_CREATE: 'comments.create',
  COMMENTS_DELETE: 'comments.delete',

  ATTACHMENTS_READ: 'attachments.read',
  ATTACHMENTS_CREATE: 'attachments.create',
  ATTACHMENTS_DELETE: 'attachments.delete',

  MEMBERS_MANAGE: 'members.manage',
  ROLES_MANAGE: 'roles.manage',
  ORGANIZATIONS_MANAGE: 'organizations.manage',
  AUDIT_READ: 'audit.read',
  DATA_IMPORT: 'data.import',
  DATA_EXPORT: 'data.export',
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** List of all permission codes (for seeds and checks). */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Default system roles (seeded by migration, never deleted). */
export const SystemRole = {
  Owner: 'owner',
  Admin: 'admin',
  Manager: 'manager',
  Agent: 'agent',
  Viewer: 'viewer',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

/* ============================ Pagination and sorting ============================ */

export type SortOrder = 'asc' | 'desc';

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasNext: boolean;
}

export interface CursorPage<T> {
  data: T[];
  meta: CursorMeta;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/* ============================ API error format ============================ */
// Matches the envelope of AllExceptionsFilter on the backend.

export interface ApiError {
  statusCode: number;
  timestamp: ISODateString;
  path: string;
  message: string;
  errors?: unknown[];
}

/* ============================ Authentication ============================ */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

/** Access token payload (JWT). */
export interface JwtPayload {
  sub: UUID;
  organizationId: UUID;
  email: string;
}

/** Result of register/login/refresh. */
export interface AuthResult {
  user: UserDto;
  tokens: AuthTokens;
}

/** Current session: GET /auth/me. */
export interface SessionInfo {
  user: UserDto;
  organizationId: UUID;
}

/* ============================ Domain models ============================ */
// numeric fields (money) are passed as strings to avoid losing precision in JS number.

export interface OrganizationDto extends BaseEntity {
  name: string;
  slug: string;
}

export interface UserDto extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  isActive: boolean;
}

/** UI languages the product supports; stored per-user as `UserDto.locale`. */
export const SUPPORTED_LOCALES = ['en', 'ru', 'uk'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** PATCH /users/me — update the current user's settings. */
export interface UpdateProfileRequest {
  locale?: AppLocale;
}

export interface RoleDto extends BaseEntity {
  organizationId: UUID;
  name: string;
  code: string;
  isSystem: boolean;
  description: string | null;
  permissions: Permission[];
}

export interface CompanyDto extends BaseEntity {
  organizationId: UUID;
  ownerId: UUID;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
}

export interface ContactDto extends BaseEntity {
  organizationId: UUID;
  ownerId: UUID;
  companyId: UUID | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
}

export interface LeadDto extends BaseEntity {
  organizationId: UUID;
  ownerId: UUID;
  source: string | null;
  status: LeadStatus;
  contactId: UUID | null;
  companyId: UUID | null;
  estimatedValue: string | null;
  currency: string | null;
  convertedDealId: UUID | null;
  lostReason: string | null;
}

export interface PipelineStageDto extends BaseEntity {
  organizationId: UUID;
  pipelineId: UUID;
  name: string;
  position: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineDto extends BaseEntity {
  organizationId: UUID;
  name: string;
  isDefault: boolean;
  position: number;
  stages: PipelineStageDto[];
}

export interface DealDto extends BaseEntity {
  organizationId: UUID;
  ownerId: UUID;
  pipelineId: UUID;
  stageId: UUID;
  title: string;
  amount: string;
  currency: string | null;
  contactId: UUID | null;
  companyId: UUID | null;
  status: DealStatus;
  expectedCloseDate: ISODateString | null;
  closedAt: ISODateString | null;
  lostReason: string | null;
}

export interface TaskDto extends BaseEntity {
  organizationId: UUID;
  ownerId: UUID;
  assigneeId: UUID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: ISODateString | null;
  completedAt: ISODateString | null;
}

export interface CommentDto extends BaseEntity {
  organizationId: UUID;
  authorId: UUID;
  entityType: CommentEntityType;
  entityId: UUID;
  body: string;
}

export interface NotificationDto extends BaseEntity {
  organizationId: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: ISODateString | null;
}

/* ============================ Endpoints ============================ */

export const API_PREFIX = '/api/v1';

export const API_ROUTES = {
  auth: `${API_PREFIX}/auth`,
  organizations: `${API_PREFIX}/organizations`,
  roles: `${API_PREFIX}/roles`,
  permissions: `${API_PREFIX}/permissions`,
  users: `${API_PREFIX}/users`,
  contacts: `${API_PREFIX}/contacts`,
  companies: `${API_PREFIX}/companies`,
  leads: `${API_PREFIX}/leads`,
  deals: `${API_PREFIX}/deals`,
  pipelines: `${API_PREFIX}/pipelines`,
  tasks: `${API_PREFIX}/tasks`,
  comments: `${API_PREFIX}/comments`,
  notifications: `${API_PREFIX}/notifications`,
  dashboard: `${API_PREFIX}/dashboard`,
  auditLogs: `${API_PREFIX}/audit-logs`,
  health: `${API_PREFIX}/health`,
} as const;

/* ============================ Redis key conventions ============================ */

export const redisKeys = {
  userPermissions: (orgId: UUID, userId: UUID) =>
    `crm:${orgId}:user:${userId}:perms`,
  dashboardSummary: (orgId: UUID) => `crm:${orgId}:dashboard:summary`,
  unreadNotifications: (orgId: UUID, userId: UUID) =>
    `crm:${orgId}:user:${userId}:notif:unread`,
} as const;
