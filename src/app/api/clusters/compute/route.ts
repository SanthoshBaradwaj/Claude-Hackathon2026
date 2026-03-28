import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { clusterResponses, computeCentroid } from '@/lib/clustering/cluster';
import { labelCluster } from '@/lib/clustering/labeling';
import {
  NOISE_CLUSTER_INDEX,
  NOISE_CLUSTER_LABEL,
  NOISE_CLUSTER_SUMMARY,
} from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { promptId } = await req.json();
    if (!promptId) {
      return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
    }

    // ── 1. Fetch all responses for this prompt ────────────────────────────
    const { data: responses, error: rErr } = await supabaseAdmin
      .from('responses')
      .select('id, user_id')
      .eq('prompt_id', promptId);

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    if (!responses || responses.length === 0) {
      return NextResponse.json({ clusters: [], assignments: [], message: 'No responses yet' });
    }

    const responseIds = responses.map((r: { id: string }) => r.id);

    // ── 2. Fetch extracted_factors for those responses ─────────────────────
    const { data: factors, error: fErr } = await supabaseAdmin
      .from('extracted_factors')
      .select('response_id, feature_vector, stance')
      .in('response_id', responseIds);

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

    const validFactors = (factors ?? []).filter(
      (f: { feature_vector: number[] | null }) =>
        Array.isArray(f.feature_vector) && f.feature_vector.length > 0
    );

    if (validFactors.length === 0) {
      return NextResponse.json({ clusters: [], assignments: [], message: 'No feature vectors yet' });
    }

    const vectors = validFactors.map((f: { feature_vector: number[] }) => f.feature_vector);

    // ── 3. Run DBSCAN ──────────────────────────────────────────────────────
    // assignments[i] = cluster index (0-based) or -1 for noise
    const assignments = clusterResponses(vectors);

    // Group point indices by cluster index
    const clusterMap = new Map<number, number[]>();
    for (let i = 0; i < assignments.length; i++) {
      const idx = assignments[i];
      if (!clusterMap.has(idx)) clusterMap.set(idx, []);
      clusterMap.get(idx)!.push(i);
    }

    const totalMembers = validFactors.length;

    // ── 4. Build cluster rows ──────────────────────────────────────────────
    const clusterRows: {
      prompt_id: string;
      cluster_index: number;
      label: string;
      centroid: number[];
      member_count: number;
      percentage: number;
      representative_summary: string | null;
    }[] = [];

    // Regular clusters sorted by index
    const regularEntries = [...clusterMap.entries()]
      .filter(([idx]) => idx !== NOISE_CLUSTER_INDEX)
      .sort(([a], [b]) => a - b);

    for (const [clusterIdx, memberIndices] of regularEntries) {
      const centroid = computeCentroid(vectors, memberIndices);
      clusterRows.push({
        prompt_id: promptId,
        cluster_index: clusterIdx,
        label: labelCluster(centroid, clusterIdx),
        centroid,
        member_count: memberIndices.length,
        percentage: (memberIndices.length / totalMembers) * 100,
        representative_summary: null,
      });
    }

    // Noise cluster — store last, only if non-empty
    const noiseIndices = clusterMap.get(NOISE_CLUSTER_INDEX) ?? [];
    if (noiseIndices.length > 0) {
      const centroid = computeCentroid(vectors, noiseIndices);
      clusterRows.push({
        prompt_id: promptId,
        cluster_index: NOISE_CLUSTER_INDEX,
        label: NOISE_CLUSTER_LABEL,
        centroid,
        member_count: noiseIndices.length,
        percentage: (noiseIndices.length / totalMembers) * 100,
        representative_summary: NOISE_CLUSTER_SUMMARY,
      });
    }

    // ── 5. Delete old clusters (assignments cascade), insert new ──────────
    await supabaseAdmin.from('clusters').delete().eq('prompt_id', promptId);

    const { data: storedClusters, error: cErr } = await supabaseAdmin
      .from('clusters')
      .insert(clusterRows)
      .select();

    if (cErr || !storedClusters) {
      return NextResponse.json(
        { error: cErr?.message ?? 'Cluster insert failed' },
        { status: 500 }
      );
    }

    // Index stored clusters by cluster_index for fast lookup
    const storedByIndex = new Map(
      storedClusters.map((c: { cluster_index: number; id: string }) => [c.cluster_index, c])
    );

    // ── 6. Insert user_cluster_assignments ────────────────────────────────
    const responseUserMap = new Map(
      responses.map((r: { id: string; user_id: string }) => [r.id, r.user_id])
    );

    const assignmentRows: {
      user_id: string;
      response_id: string;
      cluster_id: string;
    }[] = [];

    for (const [clusterIdx, memberIndices] of clusterMap.entries()) {
      const dbCluster = storedByIndex.get(clusterIdx);
      if (!dbCluster) continue;

      for (const memberIdx of memberIndices) {
        const factor = validFactors[memberIdx];
        const userId = responseUserMap.get(factor.response_id);
        if (!userId) continue;
        assignmentRows.push({
          user_id: userId,
          response_id: factor.response_id,
          cluster_id: dbCluster.id,
        });
      }
    }

    if (assignmentRows.length > 0) {
      await supabaseAdmin.from('user_cluster_assignments').insert(assignmentRows);
    }

    // ── 7. Compute demographic breakdowns ─────────────────────────────────
    // Fetch response demographic snapshots for all responses in this prompt
    const { data: demoSnapshots } = await supabaseAdmin
      .from('responses')
      .select('id, age_band_snapshot, occupation_snapshot, education_snapshot, location_snapshot, gender_snapshot')
      .in('id', responseIds);

    const snapshotMap = new Map(
      (demoSnapshots ?? []).map((r: {
        id: string;
        age_band_snapshot: string | null;
        occupation_snapshot: string | null;
        education_snapshot: string | null;
        location_snapshot: string | null;
        gender_snapshot: string | null;
      }) => [r.id, r])
    );

    const dimensions = [
      { key: 'age_band',   col: 'age_band_snapshot'   },
      { key: 'occupation', col: 'occupation_snapshot'  },
      { key: 'education',  col: 'education_snapshot'   },
      { key: 'location',   col: 'location_snapshot'    },
      { key: 'gender',     col: 'gender_snapshot'      },
    ] as const;

    // Delete existing breakdowns for clusters belonging to this prompt
    const storedClusterIds = storedClusters.map((c: { id: string }) => c.id);
    await supabaseAdmin
      .from('cluster_demographic_breakdowns')
      .delete()
      .in('cluster_id', storedClusterIds);

    const breakdownRows: {
      cluster_id: string;
      dimension: string;
      dimension_value: string;
      count: number;
      percentage: number;
    }[] = [];

    for (const [clusterIdx, memberIndices] of clusterMap.entries()) {
      const dbCluster = storedByIndex.get(clusterIdx);
      if (!dbCluster) continue;

      const memberResponseIds = memberIndices
        .map((i) => validFactors[i].response_id)
        .filter(Boolean);

      for (const { key, col } of dimensions) {
        const valueCounts = new Map<string, number>();
        for (const rid of memberResponseIds) {
          const snap = snapshotMap.get(rid);
          const val = snap?.[col];
          if (val) valueCounts.set(val, (valueCounts.get(val) ?? 0) + 1);
        }
        for (const [dimValue, count] of valueCounts.entries()) {
          breakdownRows.push({
            cluster_id: dbCluster.id,
            dimension: key,
            dimension_value: dimValue,
            count,
            percentage: (count / memberIndices.length) * 100,
          });
        }
      }
    }

    if (breakdownRows.length > 0) {
      await supabaseAdmin.from('cluster_demographic_breakdowns').insert(breakdownRows);
    }

    return NextResponse.json({
      clusters: storedClusters,
      assignments: assignmentRows,
      count: storedClusters.length,
    });
  } catch (err) {
    console.error('Cluster compute error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
