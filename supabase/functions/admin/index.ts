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

const isPlan = (value: unknown): value is 'free' | 'pro' | 'max' =>
  value === 'free' || value === 'pro' || value === 'max';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizePage = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const sanitizeSearch = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/[^\p{L}\p{N}@.+\- ]/gu, ' ').trim().slice(0, 80)
    : '';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!authorization) return jsonResponse({ error: 'Missing authorization header.' }, 401);
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Admin environment is not configured.' }, 500);
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'lts_ai' },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const { data: callerProfile, error: callerProfileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (callerProfile?.role !== 'admin') return jsonResponse({ error: 'Admin permission is required.' }, 403);

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'lts_ai' } });

    if (action === 'overview') {
      const countRows = async (table: string, column?: string, value?: string) => {
        let query = adminClient.from(table).select('id', { count: 'exact', head: true });
        if (column && value) query = query.eq(column, value);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      };

      const [totalUsers, freeUsers, proUsers, maxUsers, totalProjects, totalFiles, completedFiles, failedFiles] = await Promise.all([
        countRows('profiles'),
        countRows('profiles', 'plan', 'free'),
        countRows('profiles', 'plan', 'pro'),
        countRows('profiles', 'plan', 'max'),
        countRows('projects'),
        countRows('files_media'),
        countRows('files_media', 'status', 'completed'),
        countRows('files_media', 'status', 'failed'),
      ]);

      return jsonResponse({
        users: {
          total: totalUsers,
          by_plan: { free: freeUsers, pro: proUsers, max: maxUsers },
        },
        projects: { total: totalProjects },
        files: { total: totalFiles, completed: completedFiles, failed: failedFiles },
      });
    }

    if (action === 'list_users') {
      const page = normalizePage(body?.page, 1, 1000000);
      const pageSize = normalizePage(body?.page_size, 20, 100);
      const search = sanitizeSearch(body?.search);
      const from = (page - 1) * pageSize;
      let query = adminClient
        .from('profiles')
        .select('id,email,full_name,role,plan,daily_processed_seconds,last_processed_date,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      return jsonResponse({
        users: data || [],
        page,
        page_size: pageSize,
        total: count || 0,
      });
    }

    if (action === 'get_user_detail') {
      const targetUserId = body?.user_id;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);

      const [{ data: profile, error: profileError }, { data: projects, error: projectsError }] = await Promise.all([
        adminClient
          .from('profiles')
          .select('id,email,full_name,role,plan,daily_processed_seconds,last_processed_date,created_at')
          .eq('id', targetUserId)
          .maybeSingle(),
        adminClient
          .from('projects')
          .select('id,title,description,target_language,created_at,updated_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false }),
      ]);
      if (profileError) throw profileError;
      if (projectsError) throw projectsError;
      if (!profile) return jsonResponse({ error: 'User not found.' }, 404);

      const projectIds = (projects || []).map((project) => project.id);
      let files: any[] = [];
      if (projectIds.length > 0) {
        const { data, error } = await adminClient
          .from('files_media')
          .select('id,project_id,file_name,mime_type,duration_seconds,detected_source_lang,status,input_source,error_message,created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false });
        if (error) throw error;
        files = data || [];
      }

      return jsonResponse({ profile, projects: projects || [], files });
    }

    if (action === 'set_user_plan') {
      const targetUserId = body?.user_id;
      const plan = body?.plan;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);
      if (!isPlan(plan)) return jsonResponse({ error: 'A valid plan is required.' }, 400);

      const { data, error } = await userClient.rpc('admin_set_user_plan', {
        p_target_user_id: targetUserId,
        p_new_plan: plan,
      });
      if (error) throw error;
      return jsonResponse({ success: true, result: data });
    }

    return jsonResponse({ error: 'Unsupported admin action.' }, 400);
  } catch (error) {
    console.error('Admin function failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Admin request failed.' }, 500);
  }
});
