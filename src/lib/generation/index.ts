// Public surface of the Generation Engine. Business logic (the queue
// processor, the script-generation route) imports from here, never from
// lib/providers/* directly and never from ./engine directly — this barrel
// is the seam that keeps every category's failover/retry/timeout/cost/
// health/analytics behavior consistent and in one place.
export * from "./types";
export { generateScript } from "./llm";
export { generateImage } from "./image";
export { generateVoiceover, generateVoiceoverOrDegrade } from "./voice";
export type { VoiceoverOrDegradeResult } from "./voice";
export { transcribeAudio } from "./transcription";
export { renderVideo, mergeSceneVideos, composeTimeline } from "./video";
export { getHealthSnapshot } from "./health";
export { getUsageAnalytics, getRecentFailures } from "./usage-log";
