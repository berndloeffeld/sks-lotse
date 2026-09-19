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
}

type Named = Pick<User, 'first_name' | 'last_name'>

// "Vorname Nachname", or '' when neither is set.
export function getFullName(person: Named): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
}

export function getDisplayName(user: Named & Pick<User, 'email'>): string {
  return getFullName(user) || user.email
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

// Mirrors backend/app/schemas/admin.py::AdminUserExport.
export interface AdminUserExport {
  user: AdminUserSearchResult
  question_progress: AdminQuestionProgressExport[]
  focus_topics: AdminFocusTopicExport[]
  exported_at: string
}

// Mirrors backend/app/schemas/question.py::QuestionRead.
export interface Question {
  id: number
  subject: string
  number: number
  question_text: string
  answer_text: string
  image_ref: string | null
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
