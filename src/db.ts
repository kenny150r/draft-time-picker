import { createClient } from '@supabase/supabase-js'

const url = 'https://gcqjjpbshoogojsozflp.supabase.co'
const key = 'sb_publishable_TpjTeUpJEfplPpY9yaGm0A_rRsVs7au'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export type DraftResponse = {
  id: string
  display_name: string
  member_key: string | null
  available_slot_ids: string[]
  created_at: string
}

export function memberKey(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'member'
}

export async function submitAvailability(row: {
  display_name: string
  member_key: string
  available_slot_ids: string[]
  gauntlet_seconds: number
  rage_clicks: number
  bowling_throws: number
}): Promise<void> {
  const { error } = await supabase.from('boger_bowl_responses').upsert(
    {
      display_name: row.display_name,
      member_key: row.member_key,
      available_slot_ids: row.available_slot_ids,
      timezone: 'America/Los_Angeles',
      gauntlet_seconds: row.gauntlet_seconds,
      rage_clicks: row.rage_clicks,
      bowling_throws: row.bowling_throws,
    },
    { onConflict: 'member_key' },
  )
  if (error) throw error
}

export async function saveAvailability(row: {
  display_name: string
  member_key: string
  available_slot_ids: string[]
}): Promise<void> {
  const { error } = await supabase.from('boger_bowl_responses').upsert(
    {
      display_name: row.display_name,
      member_key: row.member_key,
      available_slot_ids: row.available_slot_ids,
      timezone: 'America/Los_Angeles',
    },
    { onConflict: 'member_key' },
  )
  if (error) throw error
}

export async function deleteAvailability(key: string): Promise<void> {
  const { error } = await supabase.from('boger_bowl_responses').delete().eq('member_key', key)
  if (error) throw error
}

export async function listResponses(): Promise<DraftResponse[]> {
  const { data, error } = await supabase
    .from('boger_bowl_responses')
    .select('id, display_name, member_key, available_slot_ids, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DraftResponse[]
}
