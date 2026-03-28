import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, ageBand, gender, location, pronouns, occupation, educationLevel, selectedCategories } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const upsertPayload: Record<string, unknown> = { session_id: sessionId };
    if (ageBand !== undefined) upsertPayload.age_band = ageBand;
    if (gender !== undefined) upsertPayload.gender = gender;
    if (location !== undefined) upsertPayload.location = location;
    if (pronouns !== undefined) upsertPayload.pronouns = pronouns;
    if (occupation !== undefined) upsertPayload.occupation = occupation;
    if (educationLevel !== undefined) upsertPayload.education_level = educationLevel;
    if (selectedCategories !== undefined) upsertPayload.selected_categories = selectedCategories;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .upsert(upsertPayload, { onConflict: 'session_id' })
      .select()
      .single();

    if (error) {
      console.error('User upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
