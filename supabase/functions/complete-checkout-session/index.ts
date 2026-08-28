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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

  if (!authorization) return jsonResponse({ error: 'Missing authorization header.' }, 401);
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !stripeSecretKey) {
    return jsonResponse({ error: 'Checkout environment is not configured.' }, 500);
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'lts_ai' },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return jsonResponse({ error: 'A valid Checkout session is required.' }, 400);
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: getStripeAuthHeader(stripeSecretKey) } }
    );
    const stripePayload = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error('Stripe Checkout session lookup failed:', stripePayload);
      return jsonResponse({ error: 'Could not verify the Stripe Checkout session.' }, 502);
    }

    const metadata = stripePayload.metadata || {};
    const isOwnedByUser = metadata.user_id === authData.user.id || stripePayload.client_reference_id === authData.user.id;
    if (!isOwnedByUser) return jsonResponse({ error: 'Checkout session does not belong to this account.' }, 403);

    const plan = metadata.plan === 'pro' || metadata.plan === 'max' ? metadata.plan : null;
    if (!plan) return jsonResponse({ error: 'Checkout session has no valid plan.' }, 400);
    if (stripePayload.status !== 'complete' || stripePayload.payment_status !== 'paid') {
      return jsonResponse({ error: 'Checkout has not been completed.' }, 409);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'lts_ai' } });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        plan,
        plan_expires_at: expiresAt,
      })
      .eq('id', authData.user.id);
    if (updateError) {
      console.error('Could not update profile after Stripe Checkout:', updateError);
      return jsonResponse({ error: 'Could not apply the selected plan.' }, 500);
    }

    return jsonResponse({ plan, plan_expires_at: expiresAt });
  } catch (error) {
    console.error('Could not complete Stripe Checkout session:', error);
    return jsonResponse({ error: 'Could not complete the Stripe Checkout session.' }, 500);
  }
});
