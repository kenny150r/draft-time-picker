import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function saveResponse(row) {
  const { data, error } = await supabase
    .from('boger_bowl_responses')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchResponses() {
  const { data, error } = await supabase
    .from('boger_bowl_responses')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
