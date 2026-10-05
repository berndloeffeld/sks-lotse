import { DEFAULT_CHECK_LIMITS, checkLimitsSource, type CheckLimits } from '../checkLimits'
import { useLazyExport } from './useLazyExport'

export function useCheckLimits(): CheckLimits {
  return useLazyExport(checkLimitsSource).data ?? DEFAULT_CHECK_LIMITS
}
