import { supabase } from '../lib/supabase';
import type { Plan } from '../types/database';

export type PaidPlan = Exclude<Plan, 'free'>;

const isPaidPlan = (value: unknown): value is PaidPlan => value === 'pro' || value === 'max';

export const stripeCheckoutService = {
  async createSession(plan: PaidPlan): Promise<string> {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan },
    });

    if (error) throw error;

    const checkoutUrl = typeof data?.url === 'string' ? data.url : '';
    if (!checkoutUrl) throw new Error('Stripe Checkout URL was not returned.');

    return checkoutUrl;
  },

  async completeSession(sessionId: string): Promise<{ plan: PaidPlan }> {
    const { data, error } = await supabase.functions.invoke('complete-checkout-session', {
      body: { sessionId },
    });

    if (error) throw error;

    if (!isPaidPlan(data?.plan)) {
      throw new Error('Stripe Checkout returned an invalid plan.');
    }

    return { plan: data.plan };
  },
};
