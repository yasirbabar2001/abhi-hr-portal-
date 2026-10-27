// Domain model for the ABHI HR portal. Every collection in the store is typed here.

export type Role = "admin" | "hr" | "hiring" | "candidate";
export const INTERNAL_ROLES: Role[] = ["admin", "hr", "hiring"];
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  hr: "HR",
  hiring: "Hiring team",
  candidate: "Candidate",
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  phone?: string;
  departmentId?: string;
  title?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";
export interface ApprovalStep {
  step: number;
  label: string;
  status: ApprovalStatus;
  by?: string; // user id
  byName?: string;
  at?: string;
  comment?: string;
}

export interface EmployeeApiSettings {
  url: string;
  authHeader: string; // e.g. "Authorization"
  authValue: string; // e.g. "Bearer xxx" (never shown in full in the UI)
  /** JSON object mapping our field -> source field path, e.g. {"employeeNo":"emp_code"} */
  fieldMap: Record<string, string>;
  /** Shared key other bank systems use to call our /api/v1 endpoints */
  outboundApiKey: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  autoSyncHours: number; // 0 = manual only
}

export interface Settings {
  companyName: string;
  shortName: string;
  primaryColor: string;
  careersIntro: string;
  supportEmail: string;
  employeeIdPrefix: string;
  /** Tokens: {PREFIX} {YYYY} {YY} {SEQ:n} {DEPT} */
  employeeIdPattern: string;
  nextEmployeeSeq: number;
  requisitionApprovalChain: string[];
  offerApprovalChain: string[];
  statusChangeApprovalChain: string[];
  blindScreening: boolean;
  autoShortlistThreshold: number; // match score >= this -> suggested shortlist
  autoRejectKnockout: boolean;
  interviewDefaultMinutes: number;
  orientationPassMark: number; // percent
  offerValidityDays: number;
  candidateDataRetentionMonths: number;
  surveysEnabled: boolean;
  employeeApi: EmployeeApiSettings;
}

export type MasterType =
  | "department"
  | "branch"
  | "region"
  | "grade"
  | "designation"
  | "employment_type"
  | "source"
  | "rejection_reason"
  | "competency"
  | "document_type"
  | "qualification";

export const MASTER_TYPES: { type: MasterType; label: string; hint: string }[] = [
  { type: "department", label: "Departments", hint: "Functions and divisions of the bank" },
  { type: "branch", label: "Branches & offices", hint: "Places of posting; meta.region links a region" },
  { type: "region", label: "Regions", hint: "Groups of branches" },
  { type: "grade", label: "Grades", hint: "Pay grades, lowest to highest" },
  { type: "designation", label: "Designations", hint: "Job titles used in requisitions and the employee master" },
  { type: "employment_type", label: "Employment types", hint: "Permanent, contract, internship…" },
  { type: "source", label: "Candidate sources", hint: "Where applicants come from" },
  { type: "rejection_reason", label: "Rejection reasons", hint: "Used when declining a candidate" },
  { type: "competency", label: "Interview competencies", hint: "Rated on interview scorecards" },
  { type: "document_type", label: "Document types", hint: "Documents collected during onboarding" },
  { type: "qualification", label: "Qualifications", hint: "Education levels, lowest to highest (meta.rank)" },
];

export interface MasterItem {
  id: string;
  type: MasterType;
  code: string;
  name: string;
  active: boolean;
  order: number;
  meta?: Record<string, string>;
}

export interface HeadcountBudget {
  id: string;
  fiscalYear: string; // "2026-27"
  departmentId: string;
  branchId?: string;
  designationId: string;
  gradeId: string;
  approvedHeadcount: number;
  annualCostPerHead: number; // PKR
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type JdStatus = "draft" | "approved" | "archived";
export interface JobDescription {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  designationId: string;
  gradeId: string;
  reportsTo: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  competencies: string[];
  minQualificationId?: string;
  minExperienceYears: number;
  keywords: string[];
  version: number;
  status: JdStatus;
  history: { version: number; at: string; by: string; note: string }[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type RequisitionStatus = "draft" | "pending" | "approved" | "rejected" | "on_hold" | "filled" | "cancelled";
export interface Requisition {
  id: string;
  code: string;
  jdId?: string;
  title: string;
  departmentId: string;
  branchId: string;
  designationId: string;
  gradeId: string;
  employmentTypeId: string;
  headcount: number;
  filled: number;
  kind: "new" | "replacement";
  replacementFor?: string;
  budgetId?: string;
  salaryMin: number;
  salaryMax: number;
  justification: string;
  targetStartDate: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: RequisitionStatus;
  approvals: ApprovalStep[];
  hiringManagerId?: string;
  recruiterId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnockoutQuestion {
  id: string;
  question: string;
  requiredAnswer: "yes" | "no";
}

export interface ScreeningCriteria {
  minQualificationId?: string;
  minExperienceYears: number;
  keywords: string[];
  preferredCities: string[];
}

export type PostingStatus = "draft" | "open" | "closed";
export interface JobPosting {
  id: string;
  requisitionId: string;
  slug: string;
  title: string;
  departmentId: string;
  branchId: string;
  city: string;
  employmentTypeId: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  channels: string[];
  visibility: "external" | "internal" | "both";
  showSalary: boolean;
  salaryMin?: number;
  salaryMax?: number;
  openDate: string;
  closeDate: string;
  status: PostingStatus;
  knockoutQuestions: KnockoutQuestion[];
  criteria: ScreeningCriteria;
  views: number;
  createdBy: string;
  createdAt: string;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  cnic: string;
  city: string;
  currentTitle: string;
  currentEmployer: string;
  totalExperienceYears: number;
  qualificationId?: string;
  institution?: string;
  skills: string[];
  linkedin?: string;
  cvFileId?: string;
  cvText?: string;
  talentPool: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Stage = "applied" | "screening" | "shortlisted" | "interview" | "verification" | "offer" | "hired";
export const STAGES: { key: Stage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview" },
  { key: "verification", label: "Verification" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
];
export type ApplicationStatus = "active" | "rejected" | "withdrawn" | "hired";

export interface ScreeningResult {
  score: number; // 0-100
  knockoutPassed: boolean;
  breakdown: { label: string; points: number; max: number; note: string }[];
  matchedKeywords: string[];
  at: string;
}

export interface Application {
  id: string;
  code: string;
  postingId: string;
  candidateId: string; // CandidateProfile id
  stage: Stage;
  status: ApplicationStatus;
  sourceId?: string;
  knockoutAnswers: Record<string, "yes" | "no">;
  coverNote?: string;
  expectedSalary?: number;
  noticePeriodDays?: number;
  screening?: ScreeningResult;
  decision?: "shortlist" | "hold" | "reject";
  decisionBy?: string;
  decisionNote?: string;
  rejectionReasonId?: string;
  stageHistory: { stage: Stage; at: string; by: string; note?: string }[];
  tags: string[];
  notes: { at: string; by: string; byName: string; text: string }[];
  consentAt: string;
  createdAt: string;
  updatedAt: string;
}

export type InterviewMode = "in_person" | "live_video" | "recorded_video";
export interface RecordedQuestion {
  id: string;
  question: string;
  thinkSeconds: number;
  maxSeconds: number;
}
export interface Interview {
  id: string;
  applicationId: string;
  round: number;
  title: string;
  mode: InterviewMode;
  start: string; // ISO; for recorded video = deadline
  durationMin: number;
  location?: string;
  meetingUrl?: string;
  panel: string[]; // user ids
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  candidateConfirmed?: boolean;
  recordedQuestions?: RecordedQuestion[];
  recordings?: { questionId: string; fileId: string; at: string }[];
  /** Live interviews may be recorded with consent; file ids of uploaded recordings */
  sessionRecordingIds?: string[];
  instructions?: string;
  createdBy: string;
  createdAt: string;
}

export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";
export interface Scorecard {
  id: string;
  interviewId: string;
  applicationId: string;
  interviewerId: string;
  ratings: { competency: string; score: number; note?: string }[];
  overall: number; // 1-5
  recommendation: Recommendation;
  strengths: string;
  concerns: string;
  submittedAt: string;
}

export interface ReferenceCheck {
  id: string;
  applicationId: string;
  refereeName: string;
  refereeEmail: string;
  refereePhone: string;
  relationship: string;
  company: string;
  token: string;
  status: "requested" | "received" | "verified" | "failed";
  response?: {
    capacity: string;
    period: string;
    performance: number; // 1-5
    integrity: number; // 1-5
    teamwork: number; // 1-5
    rehire: boolean;
    comments: string;
  };
  verifierNote?: string;
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
}

export interface EcibCheck {
  id: string;
  applicationId: string;
  cnic: string;
  consentAt?: string;
  status: "awaiting_consent" | "pending" | "submitted" | "clear" | "adverse" | "exception";
  outstanding?: number;
  overdueDays?: number;
  remarks?: string;
  reportFileId?: string;
  requestedBy: string;
  requestedAt: string;
  submittedAt?: string;
  resultAt?: string;
  decidedBy?: string;
}

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";
export interface Offer {
  id: string;
  code: string;
  applicationId: string;
  designationId: string;
  gradeId: string;
  departmentId: string;
  branchId: string;
  employmentTypeId: string;
  basicSalary: number;
  allowances: { name: string; amount: number }[];
  grossMonthly: number;
  benefits: string[];
  joiningDate: string;
  probationMonths: number;
  expiresAt: string;
  status: OfferStatus;
  approvals: ApprovalStep[];
  candidateResponse?: { at: string; signatureName?: string; reason?: string; ip?: string };
  counterOffer?: { at: string; requested: number; note: string };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentLetter {
  id: string;
  ref: string;
  offerId: string;
  applicationId: string;
  issuedAt: string;
  issuedBy: string;
  body: string; // plain text with paragraphs separated by blank lines
  status: "issued" | "acknowledged";
  acknowledgedAt?: string;
  acknowledgedName?: string;
}

export type ModuleKind = "pdf" | "video" | "presentation" | "scorm" | "quiz";
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
}
export interface OrientationModule {
  id: string;
  title: string;
  kind: ModuleKind;
  description: string;
  order: number;
  required: boolean;
  points: number;
  durationMin: number;
  fileId?: string; // pdf / video upload
  videoUrl?: string; // external video (YouTube embed / mp4)
  slides?: { title: string; body: string; emoji?: string }[];
  quiz?: { passMark: number; questions: QuizQuestion[] };
  scorm?: { packageId: string; entry: string; title?: string };
  active: boolean;
  createdAt: string;
}

export interface OrientationProgress {
  id: string;
  hireId: string;
  moduleId: string;
  status: "not_started" | "in_progress" | "completed";
  score?: number;
  points: number;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  scormData?: Record<string, string>;
}

export type OnboardingPhase = "pre_joining" | "day_one" | "first_week" | "first_30" | "first_90";
export const ONBOARDING_PHASES: { key: OnboardingPhase; label: string }[] = [
  { key: "pre_joining", label: "Before joining" },
  { key: "day_one", label: "Day one" },
  { key: "first_week", label: "First week" },
  { key: "first_30", label: "First 30 days" },
  { key: "first_90", label: "First 90 days" },
];
export interface OnboardingTask {
  id: string;
  title: string;
  phase: OnboardingPhase;
  owner: "hr" | "it" | "manager" | "new_hire" | "admin" | "finance";
  dueDate: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
  documentTypeId?: string; // when the task is "upload document X"
  fileId?: string;
}

/** A selected candidate moving from offer acceptance to employee. */
export interface Hire {
  id: string;
  applicationId: string;
  candidateId: string;
  userId: string;
  offerId: string;
  name: string;
  employeeNo?: string; // generated when orientation completes
  employeeRecordId?: string;
  status: "preboarding" | "orientation" | "onboarding" | "completed";
  joiningDate: string;
  buddyName?: string;
  managerId?: string;
  tasks: OnboardingTask[];
  badges: string[];
  createdAt: string;
  orientationCompletedAt?: string;
  completedAt?: string;
}

export type EmploymentStatus = "probation" | "confirmed" | "contract" | "resigned" | "terminated" | "retired";
export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  phone?: string;
  cnic?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  departmentId?: string;
  branchId?: string;
  designationId?: string;
  gradeId?: string;
  employmentTypeId?: string;
  managerEmployeeId?: string;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  active: boolean;
  basicSalary?: number;
  source: "api" | "portal" | "manual";
  hireId?: string;
  lastSyncedAt?: string;
  exitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type StatusChangeType =
  | "confirmation"
  | "promotion"
  | "transfer"
  | "redesignation"
  | "salary_revision"
  | "contract_renewal"
  | "resignation"
  | "termination"
  | "retirement";
export interface StatusChange {
  id: string;
  code: string;
  employeeId: string;
  type: StatusChangeType;
  from: Partial<Pick<Employee, "departmentId" | "branchId" | "designationId" | "gradeId" | "basicSalary" | "employmentStatus">>;
  to: Partial<Pick<Employee, "departmentId" | "branchId" | "designationId" | "gradeId" | "basicSalary" | "employmentStatus">>;
  effectiveDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "applied";
  approvals: ApprovalStep[];
  requestedBy: string;
  createdAt: string;
  appliedAt?: string;
}

export type Touchpoint = "application" | "interview" | "offer" | "orientation" | "onboarding";
export interface Survey {
  id: string;
  touchpoint: Touchpoint;
  applicationId?: string;
  hireId?: string;
  userId: string;
  nps: number; // 0-10
  csat: number; // 1-5
  ease: number; // 1-5 (how easy was it)
  comments?: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role | "system" | "public";
  action: string; // e.g. "requisition.approve"
  entity: string; // e.g. "requisition"
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  at: string;
}

export interface FileRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** "private": only internal staff and the uploader may read */
  visibility: "private" | "public";
  uploadedBy: string;
  at: string;
}

export interface Db {
  version: number;
  settings: Settings;
  users: User[];
  master: MasterItem[];
  budgets: HeadcountBudget[];
  jds: JobDescription[];
  requisitions: Requisition[];
  postings: JobPosting[];
  candidates: CandidateProfile[];
  applications: Application[];
  interviews: Interview[];
  scorecards: Scorecard[];
  references: ReferenceCheck[];
  ecib: EcibCheck[];
  offers: Offer[];
  letters: AppointmentLetter[];
  modules: OrientationModule[];
  progress: OrientationProgress[];
  hires: Hire[];
  employees: Employee[];
  statusChanges: StatusChange[];
  surveys: Survey[];
  audit: AuditEntry[];
  notifications: Notification[];
  files: FileRecord[];
  counters: Record<string, number>;
}
