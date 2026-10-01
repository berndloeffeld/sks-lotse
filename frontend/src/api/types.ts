// The API's shapes, generated from the backend's OpenAPI schema into schema.gen.ts by
// scripts/generate_postman_collection.sh (ADR-0046) — never edit that file by hand. What the
// schema can't say lives here: the fixed values the backend accepts and returns as plain strings
// (backend/app/schemas/common.py::one_of explains why), narrowed to their literal types.
import type { components } from './schema.gen'

type Schemas = components['schemas']
// `T` with the fields in `N` replaced by narrower types.
type Narrow<T, N extends { [K in keyof N]: K extends keyof T ? unknown : never }> = Omit<T, keyof N> & N

// Mirrors ExamVariant in backend/app/domain/exam_variant.py.
export type ExamVariant = 'motor' | 'segeln_und_motor'
// Mirrors GradingOutcome in backend/app/domain/progress.py.
export type GradingOutcome = 'richtig' | 'teilweise_richtig' | 'falsch'
// Mirrors ExamStatus / ExamResult in backend/app/domain/exam.py.
export type ExamStatus = 'in_progress' | 'grading' | 'completed'
export type ExamResult = 'bestanden' | 'muendliche_nachpruefung' | 'nicht_bestanden'

export type User = Schemas['UserRead']
export type AiGrade = Narrow<Schemas['AiGradeRead'], { outcome: GradingOutcome }>
export type TopicProgress = Schemas['TopicProgressRead']
export type Question = Schemas['QuestionRead']
export type QuestionImage = Schemas['QuestionImage']
export type Topic = Schemas['TopicRead']
export type QuestionProgress = Schemas['QuestionProgressRead']
export type RefreshSummary = Schemas['RefreshSummaryRead']
export type PublicPricing = Schemas['PublicPricing']
export type PublicTokenPackage = Schemas['PublicTokenPackage']
export type CheckoutRead = Schemas['CheckoutRead']

export type ExamSummary = Narrow<Schemas['ExamSummary'], { status: ExamStatus; result: ExamResult | null }>
export type ExamQuestion = Narrow<Schemas['ExamQuestionRead'], { outcome: GradingOutcome | null }>
export type Exam = Narrow<
  Schemas['ExamRead'],
  { status: ExamStatus; result: ExamResult | null; questions: ExamQuestion[] }
>
export type ExamStats = Narrow<
  Schemas['ExamStats'],
  { recent: Narrow<Schemas['ExamStatsPoint'], { result: ExamResult }>[] }
>

export type ChartImage = Schemas['ChartImage']
export type ChartQuestion = Schemas['ChartQuestion']
export type ChartSolutionPart = Schemas['ChartSolutionPart']
export type ChartDerivationBlock = Schemas['ChartDerivationBlock']
export type ChartExerciseSummary = Schemas['ChartExerciseSummary']
export type ChartExercisesOverview = Schemas['ChartExercisesOverview']
export type ChartAttemptTask = Schemas['ChartAttemptTaskRead']
export type ChartAttempt = Schemas['ChartAttemptRead']

export type AdminUser = Schemas['AdminUserRead']
export type AdminUserListItem = Schemas['AdminUserListItem']
export type AdminUserListPage = Schemas['AdminUserListPage']
export type AdminUserExport = Schemas['AdminUserExport']
export type AdminGradingEntry = Narrow<Schemas['AdminGradingEntry'], { outcome: GradingOutcome }>
export type AdminQuestionHistory = Narrow<
  Schemas['AdminQuestionHistory'],
  { users: Narrow<Schemas['AdminQuestionHistoryUser'], { gradings: AdminGradingEntry[] }>[] }
>
export type AdminSettings = Schemas['AdminSettings']
export type AdminMfaStatus = Schemas['AdminMfaStatus']
export type AdminMfaEnrolment = Schemas['AdminMfaEnrolment']
export type TokenPackageSettings = Schemas['TokenPackageSettings']
export type AdminBlockedEmail = Narrow<Schemas['AdminBlockedEmailRead'], { kind: 'email' | 'domain' }>
