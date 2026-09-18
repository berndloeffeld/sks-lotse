// Mirrors backend/app/schemas/auth.py::UserRead.
export interface User {
  id: number
  email: string
  created_at: string
  exam_variant: string | null
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
