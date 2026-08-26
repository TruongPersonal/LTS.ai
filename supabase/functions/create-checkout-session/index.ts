import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getStripeAuthHeader = (secretKey: string) => `Basic ${btoa(`${secretKey}:`)}`;

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const appUrl = (Deno.env.get('APP_URL') || request.headers.get('origin') || '').replace(/\/$/, '');

  if (!authorization) return jsonResponse({ error: 'Missing authorization header.' }, 401);
  if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey || !appUrl) {
    return jsonResponse({ error: 'Checkout environment is not configured.' }, 500);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'lts_ai' },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const plan = body?.plan === 'pro' || body?.plan === 'max' ? body.plan : null;
    if (!plan) return jsonResponse({ error: 'A paid plan is required.' }, 400);

    const priceId = plan === 'pro'
      ? Deno.env.get('STRIPE_PRO_PRICE_ID')
      : Deno.env.get('STRIPE_MAX_PRICE_ID');
    const checkoutMode = Deno.env.get('STRIPE_CHECKOUT_MODE') || 'subscription';
    if (!priceId || !['payment', 'subscription'].includes(checkoutMode)) {
      return jsonResponse({ error: 'Stripe price or checkout mode is not configured.' }, 500);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) return jsonResponse({ error: 'Could not load the account profile.' }, 500);

    const params = new URLSearchParams();
    params.set('mode', checkoutMode);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${appUrl}/projects?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${appUrl}/projects?checkout=cancelled`);
    params.set('client_reference_id', authData.user.id);
    params.set('metadata[user_id]', authData.user.id);
    params.set('metadata[plan]', plan);

    const email = profile?.email || authData.user.email || '';
    if (email) params.set('customer_email', email);

    if (checkoutMode === 'subscription') {
      params.set('subscription_data[metadata][user_id]', authData.user.id);
      params.set('subscription_data[metadata][plan]', plan);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: getStripeAuthHeader(stripeSecretKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const stripePayload = await stripeResponse.json();
    if (!stripeResponse.ok || typeof stripePayload.url !== 'string') {
      console.error('Stripe Checkout session creation failed:', stripePayload);
      return jsonResponse({ error: 'Could not create the Stripe Checkout session.' }, 502);
    }

    return jsonResponse({ url: stripePayload.url, sessionId: stripePayload.id });
  } catch (error) {
    console.error('Could not create Stripe Checkout session:', error);
    return jsonResponse({ error: 'Could not create the Stripe Checkout session.' }, 500);
  }
});
