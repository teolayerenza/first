// Implementación de SubmitStore sobre las funciones `rpc_*` de Postgres. La usan la Edge Function
// (vía supabase-js) y los tests (vía PGlite), así ambos ejercitan exactamente el mismo SQL.

import type { SubmitStore } from "./submit";

export type RpcCall = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

export function rpcStore(
  call: RpcCall,
  createPhotoUpload: SubmitStore["createPhotoUpload"],
): SubmitStore {
  return {
    async insideCasco([lng, lat]) {
      return Boolean(await call("rpc_inside_casco", { p_lng: lng, p_lat: lat }));
    },
    async snap([lng, lat], maxDistanceM) {
      const rows = (await call("rpc_snap", { p_lng: lng, p_lat: lat, p_max_m: maxDistanceM })) as
        | { segment_id: number | string; distance_m: number }[]
        | null;
      const r = rows?.[0];
      return r ? { segmentId: Number(r.segment_id), distanceM: r.distance_m } : null;
    },
    async segmentExists(id) {
      return Boolean(await call("rpc_segment_exists", { p_id: id }));
    },
    async issueExists(id) {
      return Boolean(await call("rpc_issue_exists", { p_id: id }));
    },
    async nearbyOpenIssues([lng, lat], radiusM) {
      const rows = (await call("rpc_nearby_open_issues", { p_lng: lng, p_lat: lat, p_radius_m: radiusM })) as
        | { id: string; kind: string; distance_m: number }[]
        | null;
      return (rows ?? []).map((r) => ({ id: r.id, kind: r.kind, distanceM: r.distance_m }));
    },
    async bumpCounter(key) {
      return Number(await call("rpc_bump_counter", { p_key: key }));
    },
    async insertRating(r) {
      await call("rpc_insert_rating", {
        p_segment_id: r.segmentId,
        p_voter_hash: r.voterHash,
        p_contributor_hash: r.contributorHash,
        p_rating: r.rating,
        p_patching: r.patching,
        p_on_site: r.onSite,
      });
    },
    async insertSegmentEvent(e) {
      await call("rpc_insert_segment_event", {
        p_segment_id: e.segmentId,
        p_voter_hash: e.voterHash,
        p_contributor_hash: e.contributorHash,
        p_type: e.type,
        p_approx_date: e.approxDate ? e.approxDate.toISOString().slice(0, 10) : null,
      });
    },
    async insertIssue(i) {
      await call("rpc_insert_issue", {
        p_id: i.id,
        p_reporter_hash: i.reporterHash,
        p_contributor_hash: i.contributorHash,
        p_kind: i.kind,
        p_parche_type: i.parcheType,
        p_severity: i.severity,
        p_lng: i.location[0],
        p_lat: i.location[1],
        p_segment_id: i.segmentId,
        p_photo_path: i.photoPath,
        p_comment: i.comment,
      });
    },
    async insertVote(v) {
      await call("rpc_insert_vote", {
        p_issue_id: v.issueId,
        p_voter_hash: v.voterHash,
        p_contributor_hash: v.contributorHash,
        p_vote: v.vote,
        p_fix_quality: v.fixQuality,
        p_mature: v.mature,
      });
    },
    createPhotoUpload,
    async publish() {
      await call("promote_pending", {});
    },
  };
}
