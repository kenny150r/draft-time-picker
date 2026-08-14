import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const url = "https://gcqjjpbshoogojsozflp.supabase.co";
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWpqcGJzaG9vZ29qc296ZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTIzNDgsImV4cCI6MjA5Njg2ODM0OH0.FgqYBf93jkHI1vblJUWM8npPx5usKrTVohUOQFFOGx0";

export const supabase = createClient(url, key);

export async function saveAvailability(row) {
  const { data, error } = await supabase
    .from("boger_bowl_responses")
    .insert({
      display_name: row.display_name,
      member_key: row.member_key,
      available_slot_ids: row.available_slot_ids,
      timezone: "America/Los_Angeles",
      gauntlet_seconds: row.gauntlet_seconds,
      rage_clicks: row.rage_clicks,
      bowling_throws: row.bowling_throws,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function loadResponses() {
  const { data, error } = await supabase
    .from("boger_bowl_responses")
    .select(
      "id, created_at, display_name, member_key, available_slot_ids, gauntlet_seconds, rage_clicks, bowling_throws"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Latest submission per member_key (or display_name if key missing). */
export function latestByMember(rows) {
  const map = new Map();
  for (const row of rows) {
    const k = row.member_key || row.display_name;
    if (!map.has(k)) map.set(k, row);
  }
  return [...map.values()];
}
