export { solve } from './solver.ts';
export { createRng } from './random.ts';
export {
  evaluateCandidate,
  hardConstraint,
  softConstraint,
  violatedConstraints,
} from './constraints.ts';
export { createAssignmentEncoding } from './encodings.ts';
export type { Assignment, AssignmentEncodingOptions } from './encodings.ts';

export { maximumBipartiteMatching } from './exact/bipartite-matching.ts';
export type {
  Adjacency,
  Bottleneck,
  MatchingResult,
} from './exact/bipartite-matching.ts';

export {
  createDailySlots,
  createMeetingProblem,
  describeSchedule,
  solveMeetingExactly,
} from './scenarios/meeting-scheduling.ts';

export {
  InputError,
  applyAvailability,
  defaultRunOptions,
  parseSpec,
  run,
  solveRequest,
} from './scenarios/meeting-request.ts';
export type {
  AvailabilityRule,
  RequestResult,
  RunOptions,
} from './scenarios/meeting-request.ts';

export {
  createPlanProblem,
  defaultPlanOptions,
  describePlan,
  planIsExactlySolvable,
  solvePlan,
  validatePlanSpec,
} from './scenarios/meeting-plan.ts';
export type {
  MeetingPlanSpec,
  MeetingRule,
  PlanBottleneck,
  PlanCertainty,
  PlanDescription,
  PlanOptions,
  PlanOutcome,
  PlannedMeeting,
  PlannedResult,
  SoftMeetingRule,
} from './scenarios/meeting-plan.ts';
export type {
  ExactSchedule,
  MeetingBottleneck,
  MeetingPreferences,
  MeetingProblemSpec,
  Person,
  ScheduledMeeting,
  Schedule,
  Slot,
} from './scenarios/meeting-scheduling.ts';

export { constraintKinds, stopReasons } from './types.ts';
export type {
  Constraint,
  ConstraintBreakdown,
  ConstraintKind,
  Encoding,
  Evaluation,
  Problem,
  Rng,
  SolveResult,
  SolverOptions,
  StopReason,
} from './types.ts';
