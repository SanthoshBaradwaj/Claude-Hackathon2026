import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { extractFeatures } from '@/lib/claude/feature-extraction';
import { encodeFeatureVector } from '@/lib/clustering/encoding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, promptId, rawText, inputMethod = 'text' } = body;

    if (!userId || !promptId || !rawText?.trim()) {
      return NextResponse.json(
        { error: 'userId, promptId, and rawText are required' },
        { status: 400 }
      );
    }

    // Fetch the prompt so we have the question text for feature extraction
    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('prompts')
      .select('id, balanced_prompt, active_prompt_type, specific_prompt, emotional_prompt, factual_prompt')
      .eq('id', promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const activePromptText =
      prompt.active_prompt_type === 'specific' ? prompt.specific_prompt :
      prompt.active_prompt_type === 'emotional' ? prompt.emotional_prompt :
      prompt.active_prompt_type === 'factual' ? prompt.factual_prompt :
      prompt.balanced_prompt;

    // Fetch user demographics for snapshotting
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('age_band, occupation, education_level, location, gender')
      .eq('id', userId)
      .single();

    // Store the response with demographic snapshot (UNIQUE constraint prevents duplicates)
    const { data: response, error: responseError } = await supabaseAdmin
      .from('responses')
      .insert({
        user_id: userId,
        prompt_id: promptId,
        raw_text: rawText.trim(),
        input_method: inputMethod,
        age_band_snapshot: userRecord?.age_band ?? null,
        occupation_snapshot: userRecord?.occupation ?? null,
        education_snapshot: userRecord?.education_level ?? null,
        location_snapshot: userRecord?.location ?? null,
        gender_snapshot: userRecord?.gender ?? null,
      })
      .select()
      .single();

    if (responseError) {
      // Unique violation: user already responded to this prompt
      if (responseError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already responded to this prompt' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: responseError.message }, { status: 500 });
    }

    // Extract semantic features via Claude
    const factors = await extractFeatures(activePromptText, rawText.trim());

    // Encode the feature vector for clustering
    const featureVector = encodeFeatureVector(factors);

    // Store extracted factors
    const { data: storedFactors, error: factorsError } = await supabaseAdmin
      .from('extracted_factors')
      .insert({
        response_id: response.id,
        stance: factors.stance,
        sentiment: factors.sentiment,
        emotion: factors.emotion,
        certainty: factors.certainty,
        primary_concern: factors.primary_concern,
        primary_value: factors.primary_value,
        trust_level: factors.trust_level,
        urgency: factors.urgency,
        policy_preference: factors.policy_preference,
        normalized_summary: factors.normalized_summary,
        keywords: factors.keywords,
        feature_vector: featureVector,
      })
      .select()
      .single();

    if (factorsError) {
      console.error('Factors insert error:', factorsError);
      // Non-fatal — response is already stored
    }

    // Increment responses_count and check unlock threshold
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('responses_count')
      .eq('id', userId)
      .single();

    const newCount = (currentUser?.responses_count ?? 0) + 1;
    const isNowUnlocked = newCount >= 2;

    await supabaseAdmin
      .from('users')
      .update({ responses_count: newCount, is_unlocked: isNowUnlocked })
      .eq('id', userId);

    return NextResponse.json({
      response,
      factors: storedFactors ?? factors,
      isUnlocked: isNowUnlocked,
    });
  } catch (err) {
    console.error('Response submit error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
