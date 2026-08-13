import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FLAC_BYTES = 19_500_000;
const MAX_SUBTITLE_CUES = 5000;

type SubtitleItem = {
  id: number;
  start: number;
  end: number;
  text: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeSegments = (segments: any[], offsetSeconds = 0): SubtitleItem[] =>
  segments
    .map((segment, index) => ({
      id: Number(segment?.id ?? index + 1),
      start: Number(segment?.start ?? 0) + offsetSeconds,
      end: Number(segment?.end ?? 0) + offsetSeconds,
      text: String(segment?.text ?? '').trim(),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.start >= 0 &&
        segment.end > segment.start &&
        segment.text.length > 0
    );

function normalizeSubmittedSubtitles(value: unknown): SubtitleItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SUBTITLE_CUES) {
    throw new Error('Source subtitle payload is empty or exceeds the submission limit.');
  }

  const normalized = normalizeSegments(value);
  if (normalized.length !== value.length) {
    throw new Error('Source subtitle payload contains invalid cues.');
  }

  return normalized
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((item, index) => ({ ...item, id: index + 1 }));
}

const TRANSCRIPTION_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
] as const;

const TRANSLATION_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
] as const;

async function transcribeFlac(
  blob: Blob,
  fileName: string,
  offsetSeconds: number,
  groqApiKey: string
) {
  let lastError: unknown = null;

  for (const model of TRANSCRIPTION_MODELS) {
    try {
      const formData = new FormData();
      formData.append('file', blob, fileName || 'audio.flac');
      formData.append('model', model);
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`${model} failed (${response.status}): ${detail.slice(0, 200)}`);
      }

      const payload = await response.json();
      const subtitles = normalizeSegments(payload.segments || [], offsetSeconds);

      return {
        sourceLanguage: String(payload.language || 'en'),
        subtitles,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Transcription Cascade] Model '${model}' failed, swapping to next model immediately...`);
    }
  }

  throw lastError || new Error('All transcription models failed.');
}

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

async function translateBatchGemini(
  subtitles: SubtitleItem[],
  sourceLanguage: string,
  targetLanguage: string,
  geminiApiKey: string
): Promise<SubtitleItem[]> {
  if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
    return subtitles;
  }
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase Secrets.');
  }

  const prompt = `You are a master subtitle translator specializing in localization for video media.
Translate every subtitle text from ${sourceLanguage} to ${targetLanguage}.

Translation Principles:
1. Translate naturally and idiomatically with high fluency, proper sentence structure, and appropriate tone for the video context.
2. Preserve exact "id", "start", and "end" values for every subtitle item without modifying timestamps.
3. Return ONLY valid JSON in this exact shape: {"subtitles":[{"id":1,"start":0.0,"end":1.5,"text":"translated text"}]}.
4. Do not add, omit, split, or merge subtitle cues. Input cues count: ${subtitles.length}.`;

  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { text: JSON.stringify({ subtitles }) },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${model} failed (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const payload = await response.json();
      const textContent = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error(`${model} returned an empty response.`);
      }

      let parsed: { subtitles?: any[] };
      try {
        parsed = JSON.parse(textContent);
      } catch {
        throw new Error(`${model} returned invalid JSON.`);
      }

      const translated = normalizeSegments(parsed.subtitles || []);
      if (translated.length !== subtitles.length) {
        throw new Error(`${model} returned ${translated.length} cues, expected ${subtitles.length}.`);
      }

      return subtitles.map((source, index) => {
        const item = translated[index];
        return {
          id: source.id,
          start: source.start,
          end: source.end,
          text: item?.text ? String(item.text).trim() : source.text,
        };
      });
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Cascade] Model '${model}' failed, trying next model...`);
    }
  }

  throw lastError || new Error('All Gemini translation models failed.');
}



serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const groqApiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    const authorization = req.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);
    }
    if (!authorization) return jsonResponse({ error: 'Missing authorization header.' }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'lts_ai' },
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const contentType = req.headers.get('content-type') || '';
    let action = '';
    let projectId = '';
    let fileId = '';
    let jsonBody: Record<string, any> = {};
    let multipartBody: FormData | null = null;

    if (contentType.includes('multipart/form-data')) {
      multipartBody = await req.formData();
      action = String(multipartBody.get('action') || '');
      projectId = String(multipartBody.get('project_id') || '');
      fileId = String(multipartBody.get('file_id') || '');
    } else {
      jsonBody = await req.json();
      action = String(jsonBody.action || '');
      projectId = String(jsonBody.project_id || '');
      fileId = String(jsonBody.file_id || '');
    }

    if (!action) return jsonResponse({ error: 'Missing action.' }, 400);

    if (action === 'translate-batch') {
      try {
        const subtitles = normalizeSubmittedSubtitles(jsonBody.subtitles || []);
        const sourceLanguage = String(jsonBody.source_language || 'en');
        const targetLanguage = String(jsonBody.target_language || 'vi');
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

        const translatedBatch = await translateBatchGemini(
          subtitles,
          sourceLanguage,
          targetLanguage,
          geminiApiKey
        );
        return jsonResponse({ success: true, subtitles: translatedBatch, provider: 'gemini-2.0-flash' });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err || 'Gemini translation failed.');
        return jsonResponse({ error: message }, 500);
      }
    }

    if (!projectId || !fileId) return jsonResponse({ error: 'Missing project_id or file_id.' }, 400);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id,target_language')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return jsonResponse({ error: 'Project not found or inaccessible.' }, 404);
    }

    const { data: file, error: fileError } = await supabase
      .from('files_media')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single();
    if (fileError || !file) {
      return jsonResponse({ error: 'File not found or inaccessible.' }, 404);
    }

    const failFile = async (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason || 'Unknown processing error');
      const { error } = await supabase
        .from('files_media')
        .update({ status: 'failed', error_message: message.slice(0, 1000) })
        .eq('id', fileId);
      if (error) console.error('Could not mark file failed:', error);
    };

    if (action === 'mark_failed') {
      if (file.status !== 'completed') {
        const message = String(jsonBody.error_message || 'Unknown processing error').slice(0, 1000);
        const { error } = await supabase
          .from('files_media')
          .update({ status: 'failed', error_message: message })
          .eq('id', fileId);
        if (error) throw error;
      }
      return jsonResponse({ success: true });
    }

    if (['transcribe_chunk', 'process_existing_subtitle', 'finalize_media'].includes(action) && !groqApiKey) {
      return jsonResponse({ error: 'GROQ_API_KEY is not configured.' }, 500);
    }

    if (action === 'transcribe_chunk') {
      if (!multipartBody) return jsonResponse({ error: 'transcribe_chunk requires multipart/form-data.' }, 400);
      if (file.input_source !== 'media') {
        return jsonResponse({ error: 'This file does not require media transcription.' }, 409);
      }
      if (!['draft', 'failed', 'processing', 'queued'].includes(file.status)) {
        return jsonResponse({ error: 'This file is not processable.' }, 409);
      }

      const audio = multipartBody.get('audio');
      const offsetSeconds = Number(multipartBody.get('chunk_start_seconds') || '0');
      if (!(audio instanceof File)) return jsonResponse({ error: 'Missing FLAC audio chunk.' }, 400);
      if (!Number.isFinite(offsetSeconds) || offsetSeconds < 0) {
        return jsonResponse({ error: 'Invalid chunk_start_seconds.' }, 400);
      }
      if (audio.size <= 0 || audio.size > MAX_FLAC_BYTES) {
        return jsonResponse({ error: 'FLAC audio chunk must be between 1 byte and 19.5 MB.' }, 413);
      }
      if (audio.type && audio.type !== 'audio/flac' && !audio.name.toLowerCase().endsWith('.flac')) {
        return jsonResponse({ error: 'Audio chunk must be FLAC.' }, 415);
      }

      const transcription = await transcribeFlac(audio, audio.name, offsetSeconds, groqApiKey);
      return jsonResponse({
        source_language: transcription.sourceLanguage,
        subtitles: transcription.subtitles,
      });
    }

    if (action === 'process_existing_subtitle') {
      if (file.input_source !== 'existing_subtitle') {
        return jsonResponse({ error: 'This file does not use an existing subtitle.' }, 409);
      }

      try {
        const { error: processingError } = await supabase
          .from('files_media')
          .update({ status: 'processing', error_message: null })
          .eq('id', fileId);
        if (processingError) throw processingError;

        const sourceLanguage = String(file.detected_source_lang || '');
        if (!sourceLanguage) throw new Error('Source subtitle language is missing.');

        const { data: existing, error: existingError } = await supabase
          .from('subtitles')
          .select('language,content')
          .eq('file_id', fileId)
          .eq('language', sourceLanguage)
          .maybeSingle();
        if (existingError) throw existingError;

        const sourceSubtitles = normalizeSubmittedSubtitles(existing?.content || []);
        const translated = await translateSubtitles(
          sourceSubtitles,
          sourceLanguage,
          project.target_language,
          groqApiKey
        );

        const { error: subtitleError } = await supabase
          .from('subtitles')
          .upsert(
            {
              file_id: fileId,
              language: project.target_language,
              content: translated,
              is_edited: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'file_id,language' }
          );
        if (subtitleError) throw subtitleError;

        const { error: completeError } = await supabase
          .from('files_media')
          .update({ status: 'completed', error_message: null })
          .eq('id', fileId);
        if (completeError) throw completeError;

        return jsonResponse({ success: true });
      } catch (error) {
        await failFile(error);
        throw error;
      }
    }

    if (action === 'finalize_media') {
      if (file.input_source !== 'media') {
        return jsonResponse({ error: 'This file does not use media transcription.' }, 409);
      }
      if (!['draft', 'failed', 'processing'].includes(file.status)) {
        return jsonResponse({ error: 'This file is not finalizable.' }, 409);
      }

      try {
        const sourceLanguage = String(jsonBody.source_language || '').trim();
        if (!sourceLanguage || sourceLanguage.length > 32) {
          return jsonResponse({ error: 'Invalid source_language.' }, 400);
        }
        const sourceSubtitles = normalizeSubmittedSubtitles(jsonBody.subtitles);

        const { error: processingError } = await supabase
          .from('files_media')
          .update({ status: 'processing', error_message: null })
          .eq('id', fileId);
        if (processingError) throw processingError;

        const { error: sourceSaveError } = await supabase
          .from('subtitles')
          .upsert(
            {
              file_id: fileId,
              language: sourceLanguage,
              content: sourceSubtitles,
              is_edited: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'file_id,language' }
          );
        if (sourceSaveError) throw sourceSaveError;

        const translated = await translateSubtitles(
          sourceSubtitles,
          sourceLanguage,
          project.target_language,
          groqApiKey
        );

        const { error: targetSaveError } = await supabase
          .from('subtitles')
          .upsert(
            {
              file_id: fileId,
              language: project.target_language,
              content: translated,
              is_edited: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'file_id,language' }
          );
        if (targetSaveError) throw targetSaveError;

        const { error: completeError } = await supabase
          .from('files_media')
          .update({
            status: 'completed',
            detected_source_lang: sourceLanguage,
            error_message: null,
          })
          .eq('id', fileId);
        if (completeError) throw completeError;

        return jsonResponse({ success: true });
      } catch (error) {
        await failFile(error);
        throw error;
      }
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonResponse({ error: message }, 500);
  }
});