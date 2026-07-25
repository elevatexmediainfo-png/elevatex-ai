// Phase 10.6B — Dynamic Scene Graph Compiler public API.
// Import from this index; never import sub-module paths directly.

export { buildSceneGraph } from "./engine";
export { renderNarrative } from "./narrative";
export type { SceneGraphDomains } from "./narrative";
export { getKnowledgeSignal, signalHasAny } from "./knowledge-bridge";
export type { KnowledgeSignal } from "./knowledge-bridge";

export type {
  SceneGraph,
  SceneGraphMeta,
  WhoGraph,
  WhereGraph,
  PoseGraph,
  BodyGraph,
  ObjectContactGraph,
  MicroMotionGraph,
  CameraGraph,
  MaterialsGraph,
} from "./types";
