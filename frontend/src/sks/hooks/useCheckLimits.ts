import { DEFAULT_CHECK_LIMITS, checkLimitsSource, type CheckLimits } from '../checkLimits'
import { useLazyExport } from '../../shared/hooks/useLazyExport'

export function useCheckLimits(): CheckLimits {
  return useLazyExport(checkLimitsSource).data ?? DEFAULT_CHECK_LIMITS
}
