// Shared (server + client safe) — how long after kickoff a match is still
// considered "live". Knockout ties can run to extra time + penalties (~165
// min); group games can't. NOTE: keep this in a plain module (NOT a 'use
// client' file) so server components can call it too.
const KNOCKOUT = new Set(['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'])

export const liveWindowMin = (stage: string) => (KNOCKOUT.has(stage) ? 170 : 130)
