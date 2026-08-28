import { supabase } from '../lib/supabase';
import { updatePlanLimitsFromQuotas, type RawQuotasConfig } from '../types/database';

export const systemService = {
  
  async fetchAndApplyQuotas(): Promise<void> {
    try {
      
      const rpcResult = await supabase.rpc('get_system_quotas');
      if (!rpcResult.error && rpcResult.data && typeof rpcResult.data === 'object') {
        updatePlanLimitsFromQuotas(rpcResult.data as RawQuotasConfig);
        return;
      }

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
