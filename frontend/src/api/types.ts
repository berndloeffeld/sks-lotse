// Mirrors ExamVariant in backend/app/core/exam_variant.py.
export type ExamVariant = 'motor' | 'segeln_und_motor'

// Mirrors backend/app/schemas/auth.py::UserRead.
export interface User {
  id: number
  email: string
  created_at: string
  exam_variant: string | null
  first_name: string | null
  last_name: string | null
  gender: string | null
  is_admin: boolean
  ai_grading_enabled: boolean
  ads_removed: boolean
  // Today's AI-check budget left (see backend/app/core/ai_quota.py).
  ai_checks_remaining: number
}

type Named = Pick<User, 'first_name' | 'last_name'>

// "Vorname Nachname", or '' when neither is set.
export function getFullName(person: Named): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
}

export function getDisplayName(user: Named & Pick<User, 'email'>): string {
  return getFullName(user) || user.email
}

// Mirrors backend/app/schemas/grading.py::AiGradeRead.
export interface AiGrade {
  outcome: GradingOutcome
  feedback: string
  remaining_today: number
}

// Mirrors backend/app/schemas/progress.py::TopicProgressRead.
export interface TopicProgress {
  subject: string
  topic_slug: string
  topic_name: string
  display_order: number
  total_questions: number
  learned_questions: number
  // Streak 1–2: on the way to "gelernt".
  learning_questions: number
  is_focus: boolean
}

// Mirrors backend/app/schemas/admin.py::AdminUserRead.
export interface AdminUserSearchResult {
  id: number
  email: string
  created_at: string
  exam_variant: string | null
  first_name: string | null
  last_name: string | null
  gender: string | null
  ai_grading_enabled: boolean
  ads_removed: boolean
  question_progress_count: number
}

// Mirrors backend/app/schemas/admin.py::AdminQuestionProgressExport.
export interface AdminQuestionProgressExport {
  question_id: number
  subject: string
  question_number: number
  correct_streak: number
  created_at: string
  updated_at: string
}

// Mirrors backend/app/schemas/admin.py::AdminFocusTopicExport.
export interface AdminFocusTopicExport {
  subject: string
  topic_slug: string
  topic_name: string
  created_at: string
}

// Mirrors backend/app/schemas/admin.py::AdminExamQuestionExport.
export interface AdminExamQuestionExport {
  position: number
  subject_group: string
  subject: string | null
  question_number: number | null
  answer_text: string | null
  outcome: string | null
}

// Mirrors backend/app/schemas/admin.py::AdminExamAttemptExport.
export interface AdminExamAttemptExport {
  exam_id: number
  exam_variant: string
  started_at: string
  deadline_at: string
  submitted_at: string | null
  graded_at: string | null
  timed_out: boolean
  questions: AdminExamQuestionExport[]
}

// Mirrors backend/app/schemas/admin.py::AdminQuestionReportExport.
export interface AdminQuestionReportExport {
  question_id: number
  subject: string
  question_number: number
  category: string
  comment: string | null
  created_at: string
}

// Mirrors backend/app/schemas/admin.py::AdminUserExport.
export interface AdminUserExport {
  user: AdminUserSearchResult
  question_progress: AdminQuestionProgressExport[]
  focus_topics: AdminFocusTopicExport[]
  question_reports: AdminQuestionReportExport[]
  exam_attempts: AdminExamAttemptExport[]
  exported_at: string
}

// Mirrors backend/app/schemas/question.py::QuestionImage. `src` is a file in /catalog/.
export interface QuestionImage {
  src: string
  width: number
  height: number
}

// Mirrors backend/app/schemas/question.py::QuestionRead.
export interface Question {
  id: number
  subject: string
  number: number
  question_text: string
  answer_text: string
  question_images: QuestionImage[]
  answer_images: QuestionImage[]
  topic: string | null
}

// Mirrors backend/app/schemas/question.py::TopicRead.
export interface Topic {
  subject: string
  slug: string
  name: string
  display_order: number
}

// Mirrors GradingOutcome in backend/app/core/progress.py.
export type GradingOutcome = 'richtig' | 'teilweise_richtig' | 'falsch'

// Mirrors backend/app/schemas/progress.py::QuestionProgressRead.
export interface QuestionProgress {
  question_id: number
  correct_streak: number
  learned: boolean
}

// Mirrors ExamStatus / ExamResult in backend/app/core/exam.py.
export type ExamStatus = 'in_progress' | 'grading' | 'completed'
export type ExamResult = 'bestanden' | 'muendliche_nachpruefung' | 'nicht_bestanden'

// Mirrors backend/app/schemas/exam.py::ExamSummary.
export interface ExamSummary {
  id: number
  status: ExamStatus
  exam_variant: string
  started_at: string
  submitted_at: string | null
  timed_out: boolean
  answered_count: number
  question_count: number
  points: number | null
  max_points: number
  result: ExamResult | null
}

// Mirrors backend/app/schemas/exam.py::ExamQuestionRead.
export interface ExamQuestion {
  position: number
  subject_group: string
  question_id: number | null
  subject: string | null
  number: number | null
  question_text: string | null
  question_images: QuestionImage[]
  answer_text: string | null
  official_answer: string | null
  official_answer_images: QuestionImage[]
  outcome: GradingOutcome | null
  points: number | null
}

// Mirrors backend/app/schemas/exam.py::ExamGroupScore.
export interface ExamGroupScore {
  subject_group: string
  points: number
  max_points: number
}

// Mirrors backend/app/schemas/exam.py::ExamRead.
export interface Exam extends ExamSummary {
  deadline_at: string
  server_now: string
  group_scores: ExamGroupScore[] | null
  questions: ExamQuestion[]
}

// Mirrors backend/app/schemas/exam.py::ExamStatsPoint / ExamStats.
export interface ExamStatsPoint {
  exam_id: number
  submitted_at: string
  points: number
  result: ExamResult
}

export interface ExamStats {
  completed_count: number
  passed_count: number
  average_points: number | null
  best_points: number | null
  max_points: number
  recent: ExamStatsPoint[]
  group_scores: ExamGroupScore[]
}
