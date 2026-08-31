// Decides what the Builder's config deep-watcher does when the live config no
// longer matches the fingerprint captured for a saved project.
//
// The baseline is snapshotted in loadConfig() before any schema has loaded. The
// schema-driven materialization (generated passwords, missing section objects)
// and the framework default run afterwards and mutate config in place, which
// otherwise trips the watcher and shows the project as edited right after open.
// Those deterministic fills set an "auto normalization in flight" marker so the
// watcher moves the baseline forward instead of flagging a user edit.
//
//  - "idle"        still hydrating, project never saved, no baseline yet, or the
//                  fingerprint is unchanged
//  - "rebaseline"  deterministic post-load normalization -> advance the baseline
//  - "dirty"       real user edit -> mark the project unsaved
export function resolveDirtyState({
  isHydrating,
  isProjectSaved,
  baseline,
  currentFingerprint,
  autoNormalizationInFlight
}) {
  if (isHydrating) return "idle";
  if (!isProjectSaved) return "idle";
  if (!baseline) return "idle";
  if (currentFingerprint === baseline) return "idle";
  return autoNormalizationInFlight ? "rebaseline" : "dirty";
}
