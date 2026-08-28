import { supabase } from '../lib/supabase';
import { updatePlanLimitsFromQuotas, type RawQuotasConfig } from '../types/database';

export const systemService = {
  /**
   * Tải hạn mức cấu hình mới nhất từ database và áp dụng vào toàn bộ frontend.
   */
  async fetchAndApplyQuotas(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'quotas')
        .maybeSingle();

      if (!error && data?.value && typeof data.value === 'object') {
        updatePlanLimitsFromQuotas(data.value as RawQuotasConfig);
      }
    } catch (err) {
      console.warn('Could not load dynamic system quotas, using default fallbacks:', err);
    }
  },
};
