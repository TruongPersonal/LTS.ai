import { useEffect, useState } from 'react';
import {
  PLAN_LIMITS,
  subscribeToPlanLimits,
  type Plan,
  type PlanLimits,
} from '../types/database';

export function usePlanLimits(): Record<Plan, PlanLimits> {
  const [limits, setLimits] = useState<Record<Plan, PlanLimits>>({
    free: { ...PLAN_LIMITS.free },
    pro: { ...PLAN_LIMITS.pro },
    max: { ...PLAN_LIMITS.max },
  });

  useEffect(() => {
    return subscribeToPlanLimits((newLimits) => {
      setLimits({
        free: { ...newLimits.free },
        pro: { ...newLimits.pro },
        max: { ...newLimits.max },
      });
    });
  }, []);

  return limits;
}
