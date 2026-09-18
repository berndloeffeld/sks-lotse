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

export function getDisplayName(user: User): string {
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email
}

// Mirrors backend/app/schemas/progress.py::TopicProgressRead.
export interface TopicProgress {
  subject: string
  topic_slug: string
  topic_name: string
  display_order: number
  total_questions: number
  learned_questions: number
}

// Mirrors backend/app/schemas/admin.py::AdminUserRead.
export interface AdminUserSearchResult {
  id: number
  email: string
  created_at: string
  exam_variant: string | null
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

// Mirrors backend/app/schemas/admin.py::AdminUserExport.
export interface AdminUserExport {
  user: AdminUserSearchResult
  question_progress: AdminQuestionProgressExport[]
  exported_at: string
}
