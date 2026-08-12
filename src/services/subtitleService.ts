import { supabase } from '../lib/supabase';
import type { SubtitleItem, SubtitleRecord } from '../types/database';

interface SubtitlePair {
  source: SubtitleRecord | null;
  target: SubtitleRecord | null;
}

export const subtitleService = {
  async getSubtitleByFile(fileId: string, language?: string): Promise<SubtitleRecord | null> {
    if (language) {
      const { data, error } = await supabase
        .from('subtitles')
        .select('*')
        .eq('file_id', fileId)
        .eq('language', language)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    }

    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .eq('file_id', fileId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSubtitlePair(
    fileId: string,
    sourceLanguage: string | null,
    targetLanguage: string
  ): Promise<SubtitlePair> {
    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .eq('file_id', fileId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const records = (data || []) as SubtitleRecord[];
    const target = records.find((r) => r.language === targetLanguage) ?? null;
    const source = (
      sourceLanguage
        ? records.find((r) => r.language === sourceLanguage)
        : undefined
    ) ?? records.find((r) => r.language !== targetLanguage) ?? target;

    return { source, target };
  },

  async saveSubtitles(fileId: string, language: string, content: SubtitleItem[]): Promise<void> {
    const { error } = await supabase
      .from('subtitles')
      .upsert(
        {
          file_id: fileId,
          language,
          content: content as unknown as Record<string, unknown>[],
          is_edited: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'file_id,language' }
      );

    if (error) throw error;
  },
};
