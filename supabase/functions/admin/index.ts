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
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

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
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (callerProfile?.role !== 'admin') return jsonResponse({ error: 'Admin permission is required.' }, 403);

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'lts_ai' } });

    const logAdminAction = async (
      actionName: string,
      targetUserId: string | null,
      details: Record<string, unknown> = {},
      oldValue: Record<string, unknown> | null = null,
    ) => {
      try {
        await adminClient.from('admin_audit_log').insert({
          actor_user_id: callerProfile.id,
          target_user_id: targetUserId,
          action: actionName,
          old_value: oldValue,
          new_value: {
            actor_email: callerProfile.email,
            ...details,
          },
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }
    };

    // -------------------------------------------------------------
    // 1. OVERVIEW & METRICS
    // -------------------------------------------------------------
    if (action === 'overview') {
      const countUsers = async (plan?: string) => {
        let query = adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user');
        if (plan) query = query.eq('plan', plan);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      };

      const countRows = async (table: string, column?: string, value?: string) => {
        let query = adminClient.from(table).select('id', { count: 'exact', head: true });
        if (column && value) query = query.eq(column, value);
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      };

      const [
        totalUsers,
        freeUsers,
        proUsers,
        maxUsers,
        totalProjects,
        totalFiles,
        completedFiles,
        failedFiles,
        durationResult,
      ] = await Promise.all([
        countUsers(),
        countUsers('free'),
        countUsers('pro'),
        countUsers('max'),
        countRows('projects'),
        countRows('files_media'),
        countRows('files_media', 'status', 'completed'),
        countRows('files_media', 'status', 'failed'),
        adminClient.from('files_media').select('duration_seconds').eq('status', 'completed'),
      ]);

      const totalProcessedSeconds = (durationResult.data || []).reduce(
        (acc: number, item: { duration_seconds: number | null }) => acc + (item.duration_seconds || 0),
        0
      );

      // Monthly Recurring Revenue: query live Stripe API if configured, otherwise calculate from regular Pro & Max users
      let revenueAmount = proUsers * 10 + maxUsers * 29;
      let revenueSource = 'plan_estimate';

      if (stripeSecretKey) {
        try {
          const authHeader = `Basic ${btoa(`${stripeSecretKey}:`)}`;
          const balanceRes = await fetch('https://api.stripe.com/v1/balance', {
            headers: { Authorization: authHeader },
          });
          if (balanceRes.ok) {
            const balanceData = await balanceRes.json();
            const availableUsd = (balanceData.available || []).find((b: { currency: string; amount: number }) => b.currency === 'usd')?.amount || 0;
            const pendingUsd = (balanceData.pending || []).find((b: { currency: string; amount: number }) => b.currency === 'usd')?.amount || 0;
            const totalBalance = (availableUsd + pendingUsd) / 100;
            if (totalBalance > 0) {
              revenueAmount = Math.round(totalBalance);
              revenueSource = 'stripe_balance';
            }
          }
        } catch (err) {
          console.warn('[Admin Overview] Failed to fetch live Stripe balance:', err);
        }
      }

      const successRate = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 100;

      return jsonResponse({
        revenue: {
          estimated_mrr: revenueAmount,
          currency: 'USD',
          source: revenueSource,
        },
        users: {
          total: totalUsers,
          by_plan: { free: freeUsers, pro: proUsers, max: maxUsers },
        },
        projects: { total: totalProjects },
        files: {
          total: totalFiles,
          completed: completedFiles,
          failed: failedFiles,
          total_processed_seconds: totalProcessedSeconds,
          success_rate: Math.round(successRate * 10) / 10,
        },
      });
    }

    // -------------------------------------------------------------
    // 2. USER MANAGEMENT
    // -------------------------------------------------------------
    if (action === 'list_users') {
      const page = normalizePage(body?.page, 1, 1000000);
      const pageSize = normalizePage(body?.page_size, 20, 100);
      const search = sanitizeSearch(body?.search);
      const planFilter = typeof body?.plan === 'string' ? body.plan : '';
      const roleFilter = typeof body?.role === 'string' ? body.role : '';

      const from = (page - 1) * pageSize;
      let query = adminClient
        .from('profiles')
        .select('id,email,full_name,role,plan,plan_expires_at,daily_processed_seconds,last_processed_date,created_at,is_banned', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      if (planFilter && ['free', 'pro', 'max'].includes(planFilter)) query = query.eq('plan', planFilter);
      if (roleFilter && ['user', 'admin'].includes(roleFilter)) query = query.eq('role', roleFilter);

      const { data, count, error } = await query;
      if (error) throw error;

      return jsonResponse({
        users: (data || []).map((u: any) => ({
          ...u,
          is_banned: Boolean(u.is_banned),
        })),
        page,
        page_size: pageSize,
        total: count || 0,
      });
    }

    if (action === 'ban_user') {
      const targetUserId = body?.user_id;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);
      if (targetUserId === callerProfile.id) return jsonResponse({ error: 'You cannot ban yourself.' }, 400);

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('email, full_name, role, plan')
        .eq('id', targetUserId)
        .maybeSingle();

      // Ban in Supabase Auth & update profiles table
      const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: '876000h',
        user_metadata: { is_banned: true },
      });
      if (banError) throw banError;

      await adminClient.from('profiles').update({ is_banned: true }).eq('id', targetUserId);

      await logAdminAction(
        'BAN_USER',
        targetUserId,
        {
          target_user_id: targetUserId,
          target_email: targetProfile?.email,
          target_name: targetProfile?.full_name,
          is_banned: true,
        },
        {
          is_banned: false,
          role: targetProfile?.role,
        },
      );
      return jsonResponse({ success: true, message: 'User has been banned.' });
    }

    if (action === 'unban_user') {
      const targetUserId = body?.user_id;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('email, full_name, role, plan')
        .eq('id', targetUserId)
        .maybeSingle();

      const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none',
        user_metadata: { is_banned: false },
      });
      if (unbanError) throw unbanError;

      await adminClient.from('profiles').update({ is_banned: false }).eq('id', targetUserId);

      await logAdminAction(
        'UNBAN_USER',
        targetUserId,
        {
          target_user_id: targetUserId,
          target_email: targetProfile?.email,
          target_name: targetProfile?.full_name,
          is_banned: false,
        },
        {
          is_banned: true,
          role: targetProfile?.role,
        },
      );
      return jsonResponse({ success: true, message: 'User has been unbanned.' });
    }

    if (action === 'set_user_role') {
      const targetUserId = body?.user_id;
      const newRole = body?.role;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);
      if (newRole !== 'admin' && newRole !== 'user') return jsonResponse({ error: 'Role must be user or admin.' }, 400);
      if (targetUserId === callerProfile.id && newRole !== 'admin') {
        return jsonResponse({ error: 'You cannot remove your own admin role.' }, 400);
      }

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('email, full_name, role')
        .eq('id', targetUserId)
        .maybeSingle();

      const { error: roleError } = await adminClient
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);
      if (roleError) throw roleError;

      await logAdminAction(
        'SET_ROLE',
        targetUserId,
        {
          target_user_id: targetUserId,
          target_email: targetProfile?.email,
          target_name: targetProfile?.full_name,
          role: newRole,
        },
        {
          role: targetProfile?.role || 'user',
        },
      );
      return jsonResponse({ success: true, message: 'User role updated.' });
    }

    if (action === 'reset_user_quota') {
      const targetUserId = body?.user_id;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('email, full_name, daily_processed_seconds')
        .eq('id', targetUserId)
        .maybeSingle();

      const { error: resetError } = await adminClient
        .from('profiles')
        .update({ daily_processed_seconds: 0 })
        .eq('id', targetUserId);
      if (resetError) throw resetError;

      await logAdminAction(
        'RESET_QUOTA',
        targetUserId,
        {
          target_user_id: targetUserId,
          target_email: targetProfile?.email,
          target_name: targetProfile?.full_name,
          daily_processed_seconds: 0,
        },
        {
          daily_processed_seconds: targetProfile?.daily_processed_seconds || 0,
        },
      );
      return jsonResponse({ success: true, message: 'User daily quota reset to 0.' });
    }

    if (action === 'delete_user') {
      const targetUserId = body?.user_id;
      if (!isUuid(targetUserId)) return jsonResponse({ error: 'A valid user_id is required.' }, 400);
      if (targetUserId === callerProfile.id) return jsonResponse({ error: 'You cannot delete yourself.' }, 400);

      // Fetch user profile before deletion for audit trail
      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('email, full_name, role, plan')
        .eq('id', targetUserId)
        .maybeSingle();

      // Log with null target_user_id so foreign key constraint doesn't block auth.users deletion
      await logAdminAction(
        'DELETE_USER',
        null,
        {
          target_email: targetProfile?.email,
          target_name: targetProfile?.full_name,
          deleted: true,
        },
        {
          email: targetProfile?.email,
          full_name: targetProfile?.full_name,
          role: targetProfile?.role,
          plan: targetProfile?.plan,
        },
      );

      // Delete user from auth.users (cascades to profiles, projects, files)
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) {
        // Fallback explicit delete from profiles
        await adminClient.from('profiles').delete().eq('id', targetUserId);
      }

      return jsonResponse({ success: true, message: 'User deleted successfully.' });
    }

    // -------------------------------------------------------------
    // 3. PROJECTS & FILES MANAGEMENT
    // -------------------------------------------------------------
    if (action === 'list_projects') {
      const page = normalizePage(body?.page, 1, 1000000);
      const pageSize = normalizePage(body?.page_size, 20, 100);
      const search = sanitizeSearch(body?.search);
      const from = (page - 1) * pageSize;

      let query = adminClient
        .from('projects')
        .select(`
          id,
          user_id,
          title,
          description,
          target_language,
          created_at,
          updated_at,
          profiles:user_id ( id, email, full_name ),
          files_media:files_media(count)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const formattedProjects = (data || []).map((project: any) => ({
        id: project.id,
        user_id: project.user_id,
        title: project.title,
        description: project.description,
        target_language: project.target_language,
        created_at: project.created_at,
        updated_at: project.updated_at,
        user_email: project.profiles?.email || '—',
        user_name: project.profiles?.full_name || '—',
        files_count: Array.isArray(project.files_media) ? project.files_media[0]?.count || 0 : 0,
      }));

      return jsonResponse({
        projects: formattedProjects,
        page,
        page_size: pageSize,
        total: count || 0,
      });
    }

    if (action === 'get_project_files') {
      const projectId = body?.project_id;
      if (!isUuid(projectId)) return jsonResponse({ error: 'A valid project_id is required.' }, 400);

      const { data: files, error: filesError } = await adminClient
        .from('files_media')
        .select('id,project_id,drive_file_id,file_name,mime_type,duration_seconds,detected_source_lang,status,input_source,error_message,created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      return jsonResponse({ files: files || [] });
    }

    if (action === 'get_file_subtitles') {
      const fileId = body?.file_id;
      if (!isUuid(fileId)) return jsonResponse({ error: 'A valid file_id is required.' }, 400);

      const { data: subtitles, error: subsError } = await adminClient
        .from('subtitles')
        .select('id,file_id,language,content,is_edited,updated_at')
        .eq('file_id', fileId);

      if (subsError) throw subsError;

      return jsonResponse({ subtitles: subtitles || [] });
    }

    if (action === 'delete_project') {
      const projectId = body?.project_id;
      if (!isUuid(projectId)) return jsonResponse({ error: 'A valid project_id is required.' }, 400);

      const { data: project } = await adminClient
        .from('projects')
        .select('title, user_id, target_language, profiles:user_id(email)')
        .eq('id', projectId)
        .maybeSingle();

      const { error: deleteError } = await adminClient.from('projects').delete().eq('id', projectId);
      if (deleteError) throw deleteError;

      await logAdminAction(
        'DELETE_PROJECT',
        project?.user_id || null,
        {
          target_project_id: projectId,
          project_title: project?.title,
          owner_email: (project?.profiles as any)?.email,
          deleted: true,
        },
        {
          project_id: projectId,
          project_title: project?.title,
          target_language: project?.target_language,
        },
      );

      return jsonResponse({ success: true, message: 'Project deleted.' });
    }

    if (action === 'delete_file') {
      const fileId = body?.file_id;
      if (!isUuid(fileId)) return jsonResponse({ error: 'A valid file_id is required.' }, 400);

      const { data: file } = await adminClient
        .from('files_media')
        .select('file_name, project_id, duration_seconds, status')
        .eq('id', fileId)
        .maybeSingle();

      const { error: deleteError } = await adminClient.from('files_media').delete().eq('id', fileId);
      if (deleteError) throw deleteError;

      await logAdminAction(
        'DELETE_FILE',
        null,
        {
          target_file_id: fileId,
          file_name: file?.file_name,
          deleted: true,
        },
        {
          file_id: fileId,
          file_name: file?.file_name,
          duration_seconds: file?.duration_seconds,
          status: file?.status,
        },
      );

      return jsonResponse({ success: true, message: 'File deleted.' });
    }

    if (action === 'delete_subtitles') {
      const fileId = body?.file_id;
      if (!isUuid(fileId)) return jsonResponse({ error: 'A valid file_id is required.' }, 400);

      const { error: deleteError } = await adminClient.from('subtitles').delete().eq('file_id', fileId);
      if (deleteError) throw deleteError;

      await logAdminAction(
        'DELETE_SUBTITLE',
        null,
        { target_file_id: fileId, deleted: true },
        { file_id: fileId },
      );
      return jsonResponse({ success: true, message: 'Subtitles deleted.' });
    }

    // -------------------------------------------------------------
    // 4. SYSTEM LIMITS & AI MODELS CONFIGURATION
    // -------------------------------------------------------------
    if (action === 'get_system_config') {
      const maskKey = (key: string | undefined, prefixLen = 4, suffixLen = 4) => {
        if (!key || key.length < 8) return '';
        return `${key.slice(0, prefixLen)}••••••••${key.slice(-suffixLen)}`;
      };

      const { data: quotaRow } = await adminClient
        .from('system_settings')
        .select('value')
        .eq('key', 'quotas')
        .maybeSingle();

      const dbQuotas = (quotaRow?.value as Record<string, any>) || {};

      return jsonResponse({
        quotas: {
          free_daily_minutes: dbQuotas.free_daily_minutes ?? 10,
          free_max_file_size_mb: dbQuotas.free_max_file_size_mb ?? 50,
          pro_daily_minutes: dbQuotas.pro_daily_minutes ?? 60,
          pro_max_file_size_mb: dbQuotas.pro_max_file_size_mb ?? 200,
          max_daily_minutes: dbQuotas.max_daily_minutes ?? 300,
          max_max_file_size_mb: dbQuotas.max_max_file_size_mb ?? 500,
        },
        models: {
          asr_primary_model: 'whisper-large-v3-turbo',
          asr_fallback_model: 'whisper-large-v3',
          translation_primary_model: 'gemini-2.5-flash',
          translation_fallback_models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
          available_asr_models: [
            { id: 'whisper-large-v3-turbo', name: 'OpenAI Whisper Large v3 Turbo (Groq - Siêu nhanh)' },
            { id: 'whisper-large-v3', name: 'OpenAI Whisper Large v3 (Groq - Độ chính xác cao)' },
          ],
          available_translation_models: [
            { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash (Default - Tốc độ & Chuẩn xác)' },
            { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash (Fallback 1)' },
            { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash (Fallback 2)' },
            { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro (Deep Context)' },
          ],
        },
        api_status: {
          groq_configured: Boolean(groqApiKey),
          gemini_configured: Boolean(geminiApiKey),
          stripe_configured: Boolean(stripeSecretKey),
          groq_key_masked: maskKey(groqApiKey, 6, 4),
          gemini_key_masked: maskKey(geminiApiKey, 6, 4),
          stripe_key_masked: maskKey(stripeSecretKey, 7, 4),
        },
      });
    }

    if (action === 'update_system_config') {
      const { quotas } = body;

      // 1. Fetch current quotas for old_value
      const { data: existingRow } = await adminClient
        .from('system_settings')
        .select('value')
        .eq('key', 'quotas')
        .maybeSingle();

      const existingQuotas = (existingRow?.value as Record<string, any>) || {};

      // 2. Persist quotas if provided
      const savedQuotas = {
        free_daily_minutes: Number(quotas?.free_daily_minutes) || 10,
        free_max_file_size_mb: Number(quotas?.free_max_file_size_mb) || 50,
        pro_daily_minutes: Number(quotas?.pro_daily_minutes) || 60,
        pro_max_file_size_mb: Number(quotas?.pro_max_file_size_mb) || 200,
        max_daily_minutes: Number(quotas?.max_daily_minutes) || 300,
        max_max_file_size_mb: Number(quotas?.max_max_file_size_mb) || 500,
      };

      await adminClient.from('system_settings').upsert({
        key: 'quotas',
        value: savedQuotas,
        updated_at: new Date().toISOString(),
      });

      // 3. Record Audit Log
      await logAdminAction(
        'UPDATE_SYSTEM_CONFIG',
        null,
        {
          quotas: savedQuotas,
        },
        {
          quotas: existingQuotas,
        },
      );

      return jsonResponse({ success: true, message: 'System configuration updated successfully.' });
    }

    // -------------------------------------------------------------
    // 5. AUDIT LOGS
    // -------------------------------------------------------------
    if (action === 'list_audit_logs') {
      const page = normalizePage(body?.page, 1, 1000000);
      const pageSize = normalizePage(body?.page_size, 20, 100);
      const from = (page - 1) * pageSize;

      const { data: logs, count, error: logsError } = await adminClient
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (logsError) throw logsError;

      return jsonResponse({
        logs: logs || [],
        page,
        page_size: pageSize,
        total: count || 0,
      });
    }

    return jsonResponse({ error: 'Unsupported admin action.' }, 400);
  } catch (error) {
    console.error('Admin function failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Admin request failed.' }, 500);
  }
});
