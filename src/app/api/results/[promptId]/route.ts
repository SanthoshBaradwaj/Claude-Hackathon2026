import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { euclideanDistance } from '@/lib/clustering/cluster';
import { CLUSTER_PALETTE, NOISE_CLUSTER_INDEX } from '@/lib/constants';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ promptId: string }> }
) {
  try {
    const { promptId } = await props.params;
    const userId = req.nextUrl.searchParams.get('userId');

    // ── Server-side unlock check ──────────────────────────────────────────
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('is_unlocked')
        .eq('id', userId)
        .single();

      if (!user?.is_unlocked) {
        return NextResponse.json({ error: 'Not unlocked' }, { status: 403 });
      }
    }

    // ── Fetch clusters for this prompt ────────────────────────────────────
    const { data: clusters, error: cErr } = await supabaseAdmin
      .from('clusters')
      .select('*')
      .eq('prompt_id', promptId)
      .order('cluster_index');

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!clusters || clusters.length === 0) {
      return NextResponse.json(
        { error: 'No clusters computed yet for this prompt' },
        { status: 404 }
      );
    }

    // ── Find the user's cluster assignment (if they responded) ────────────
    let userCluster: (typeof clusters)[0] | null = null;

    if (userId) {
      const { data: assignment } = await supabaseAdmin
        .from('user_cluster_assignments')
        .select('cluster_id, response_id')
        .eq('user_id', userId)
        .in('cluster_id', clusters.map((c: { id: string }) => c.id))
        .limit(1)
        .single();

      if (assignment) {
        userCluster =
          clusters.find((c: { id: string }) => c.id === assignment.cluster_id) ?? null;
      }
    }

    // ── Identify opposing / middle clusters ───────────────────────────────
    // Non-noise clusters for distance comparisons
    const namedClusters = clusters.filter(
      (c: { cluster_index: number }) => c.cluster_index !== NOISE_CLUSTER_INDEX
    );

    let opposingCluster: (typeof clusters)[0] | null = null;
    let middleCluster:   (typeof clusters)[0] | null = null;

    const baseCluster = userCluster?.cluster_index !== NOISE_CLUSTER_INDEX
      ? userCluster
      : null;

    if (baseCluster && namedClusters.length >= 2) {
      let maxDist = -1;
      for (const c of namedClusters) {
        if (c.id === baseCluster.id) continue;
        const dist = euclideanDistance(
          baseCluster.centroid ?? [],
          c.centroid ?? []
        );
        if (dist > maxDist) {
          maxDist = dist;
          opposingCluster = c;
        }
      }
      middleCluster =
        namedClusters.find(
          (c: { id: string }) =>
            c.id !== baseCluster.id && c.id !== opposingCluster?.id
        ) ?? null;
    }

    // ── Fetch representative summaries ────────────────────────────────────
    async function getSummaries(clusterId: string): Promise<string[]> {
      const { data: asgn } = await supabaseAdmin
        .from('user_cluster_assignments')
        .select('response_id')
        .eq('cluster_id', clusterId)
        .limit(3);

      if (!asgn || asgn.length === 0) return [];

      const { data: ef } = await supabaseAdmin
        .from('extracted_factors')
        .select('normalized_summary')
        .in('response_id', asgn.map((a: { response_id: string }) => a.response_id));

      return (ef ?? [])
        .map((e: { normalized_summary: string }) => e.normalized_summary)
        .filter(Boolean);
    }

    const [similarVoices, opposingVoices, middleVoices] = await Promise.all([
      userCluster     ? getSummaries(userCluster.id)     : Promise.resolve([]),
      opposingCluster ? getSummaries(opposingCluster.id) : Promise.resolve([]),
      middleCluster   ? getSummaries(middleCluster.id)   : Promise.resolve([]),
    ]);

    // ── Build distribution — colour by palette index, noise always last ───
    const distribution = clusters.map(
      (c: { id: string; label: string; percentage: number; cluster_index: number }) => {
        const colorIndex =
          c.cluster_index === NOISE_CLUSTER_INDEX
            ? CLUSTER_PALETTE.length - 1   // put noise at the end of palette
            : c.cluster_index % (CLUSTER_PALETTE.length - 1);
        return {
          id: c.id,
          label: c.label,
          percentage: Math.round(c.percentage),
          color: CLUSTER_PALETTE[colorIndex],
          isUser: c.id === userCluster?.id,
          isNoise: c.cluster_index === NOISE_CLUSTER_INDEX,
        };
      }
    );

    return NextResponse.json({
      clusters,
      userCluster,
      distribution,
      voices: {
        similar:  similarVoices,
        opposing: opposingVoices,
        middle:   middleVoices,
        opposingLabel: opposingCluster?.label ?? null,
        middleLabel:   middleCluster?.label   ?? null,
      },
    });
  } catch (err) {
    console.error('Results fetch error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
