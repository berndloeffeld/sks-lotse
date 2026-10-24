// SBF Lotse's API shapes, generated from the backend's OpenAPI schema (ADR-0046) into
// ../../shared/api/schema.gen.ts — never edit that file by hand. The saved runs of the
// Navigationsaufgaben (ADR-0071).
import type { components } from '../../shared/api/schema.gen'

type Schemas = components['schemas']

export type SbfNavigationOverview = Schemas['SbfNavigationOverview']
export type SbfNavigationTaskSummary = Schemas['SbfNavigationTaskSummary']
export type SbfNavigationAttempt = Schemas['SbfNavigationAttemptRead']
export type SbfNavigationSubtask = Schemas['SbfNavigationSubtaskRead']
export type SbfNavigationAiSuggestion = Schemas['SbfNavigationAiSuggestion']
export type SbfNavigationAiCheck = Schemas['SbfNavigationAiCheckRead']
