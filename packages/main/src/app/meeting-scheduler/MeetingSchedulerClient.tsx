'use client';

import { useState } from 'react';

import BasePageTemplate from '@/templates/BasePageTemplate';
import Button from '@swiftpost/elysium/ui/base/Button';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import TextField from '@swiftpost/elysium/ui/base/TextField ';
import { InputError, solveRequest } from '@swiftpost/genetic-solver';
import type { RequestResult } from '@swiftpost/genetic-solver';

/**
 * The examples are the documentation, which is why there are four.
 *
 * The roster is the short form and the one that keeps the proof. The plan shows
 * everything the roster cannot say — a two-person meeting, someone needing two
 * meetings, and rules relating them — and is deliberately the same request the
 * roster could not express, so the difference is legible by reading both.
 *
 * Availability is the third because it is orthogonal to that choice: it works
 * with either shape, and its whole point is what it replaces. Read against the
 * roster's hand-listed slot ids, the same request is four lines instead of one
 * per person per slot, and it survives the grid changing.
 *
 * The fourth is the one that cannot be said with availability at all: a wish
 * rather than a constraint, and a meeting that exists only because another was
 * chosen. It is the useful counterweight to the third — stating "weekends are
 * better" as availability makes the plan fail where it should merely cost more.
 */
const rosterExample = `{
  "days": ["mon", "tue"],
  "slotsPerDay": 3,
  "people": [
    { "id": "ana", "availableSlotIds": ["mon#0", "mon#1"] },
    { "id": "bo", "availableSlotIds": ["mon#1", "tue#0"] },
    { "id": "cy", "availableSlotIds": ["tue#0", "tue#2"] }
  ],
  "preferences": { "compactDaysWeight": 0, "earlinessWeight": 0 }
}`;

const planExample = `{
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "slotsPerDay": 3,
  "needs": { "ana": 1, "bo": 1, "zoe": 1, "jerry": 2 },
  "meetings": [
    { "id": "ana-solo", "attendees": ["ana"] },
    { "id": "bo-solo", "attendees": ["bo"] },
    { "id": "zoe-solo", "attendees": ["zoe"] },
    { "id": "bo-zoe-lunch", "attendees": ["bo", "zoe"],
      "allowedSlotOfDay": [1] },
    { "id": "jerry-1", "attendees": ["jerry"] },
    { "id": "jerry-2", "attendees": ["jerry"] }
  ],
  "rules": [
    { "kind": "spacing", "person": "jerry", "minDays": 2 },
    { "kind": "not-same-day", "people": ["ana", "bo"] },
    { "kind": "avoid", "meeting": "bo-zoe-lunch", "weight": 5 }
  ]
}`;

const availabilityExample = `{
  "days": ["mon", "tue", "wed", "thu", "fri"],
  "slotsPerDay": 3,
  "people": [
    { "id": "sally" },
    { "id": "bob" },
    { "id": "floyd" },
    { "id": "paul" }
  ],
  "availability": [
    { "kind": "busy", "person": "sally", "days": ["tue"] },
    { "kind": "busy", "person": "floyd", "slotOfDay": [1] },
    { "kind": "free", "person": "paul", "days": ["wed"] },
    { "kind": "busy", "person": "paul", "days": ["wed"], "slotOfDay": [1] }
  ],
  "preferences": { "compactDaysWeight": 1 }
}`;

const preferenceExample = `{
  "days": ["thu", "fri", "sat", "sun"],
  "slotsPerDay": 3,
  "needs": { "alex": 1, "kia": 1, "john": 1 },
  "meetings": [
    { "id": "alex", "attendees": ["alex"] },
    { "id": "kia", "attendees": ["kia"] },
    { "id": "john-dinner-out", "attendees": ["john"] },
    { "id": "john-dinner-home", "attendees": ["john"] },
    { "id": "john-prep", "attendees": ["john"], "countsTowardNeeds": false }
  ],
  "rules": [
    { "kind": "prefer", "person": "alex", "days": ["thu", "fri"], "weight": 2 },
    { "kind": "prefer", "person": "kia", "days": ["sat", "sun"], "weight": 2 },
    { "kind": "prefer", "person": "john", "slotOfDay": [0], "weight": 1 },
    { "kind": "avoid", "meeting": "john-dinner-out", "weight": 2 },
    { "kind": "together", "meetings": ["john-prep", "john-dinner-home"] },
    { "kind": "consecutive", "first": "john-prep", "second": "john-dinner-home" }
  ]
}`;

/** "1 slot" rather than "1 slots" — the bottleneck line reads as a sentence. */
const count = (value: number, singular: string, plural: string): string =>
  `${String(value)} ${value === 1 ? singular : plural}`;

const MeetingSchedulerClient: React.FC = () => {
  const [spec, setSpec] = useState(rosterExample);
  const [result, setResult] = useState<RequestResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const loadExample = (example: string) => () => {
    setSpec(example);
    setResult(undefined);
    setError(undefined);
  };

  const handleSolve = () => {
    try {
      setResult(solveRequest(spec));
      setError(undefined);
    } catch (caught) {
      // InputError is a malformed spec and RangeError is one the scenario
      // rejects. Both are the user's to fix, so both are shown verbatim rather
      // than reduced to a generic failure.
      if (caught instanceof InputError || caught instanceof RangeError) {
        setError(caught.message);
        setResult(undefined);
        return;
      }

      throw caught;
    }
  };

  return (
    <BasePageTemplate>
      <Stack spacing={3} paddingY={4}>
        <Stack spacing={1}>
          <Text variant="h4" component="h1">
            Meeting Scheduler
          </Text>
          <Text color="text.secondary">
            Place meetings into slots without booking anybody when they are
            unavailable. A roster — one meeting each — is solved exactly: the
            plan is guaranteed valid, and a failure is a proof that none exists.
            A plan with joint meetings or rules relating people is searched
            instead, and then a failure only means none was found. Either shape
            can state when people are busy as rules — by day, by position in the
            day, or both — rather than listing the slots that are left. What is
            merely preferred is said the same way and priced instead of
            enforced, so it bends the plan rather than breaking it.
          </Text>
        </Stack>

        <TextField
          label="Spec (JSON)"
          value={spec}
          onChange={(event) => {
            setSpec(event.target.value);
          }}
          multiline
          minRows={12}
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
        />

        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleSolve}>
            Solve
          </Button>
          <Button onClick={loadExample(rosterExample)}>Roster example</Button>
          <Button onClick={loadExample(planExample)}>Plan example</Button>
          <Button onClick={loadExample(availabilityExample)}>
            Availability example
          </Button>
          <Button onClick={loadExample(preferenceExample)}>
            Preference example
          </Button>
        </Stack>

        {error !== undefined && (
          <Text color="error" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </Text>
        )}

        {result && <ResultView {...result} />}
      </Stack>
    </BasePageTemplate>
  );
};

/**
 * A failed search and a proof of impossibility must never read alike.
 *
 * Only the exact solver earns "no plan exists"; anything the genetic search
 * gave up on says so plainly, because a user who trusts the stronger wording
 * will stop looking for a plan that may well be there.
 */
const FailureView: React.FC<{ outcome: RequestResult['outcome'] }> = ({
  outcome,
}) => {
  if (outcome.certainty === 'not-found') {
    return (
      <Stack spacing={1}>
        <Text variant="h6">No plan found</Text>
        <Text color="text.secondary">
          This is not a proof. The search gave up, and a plan may still exist —
          this request uses rules that put it beyond the exact solver. Try
          loosening a rule.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Text variant="h6">No plan exists</Text>
      <Text color="text.secondary">This is a proof, not a failed search.</Text>
      {outcome.bottleneck && (
        <Text component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
          {`${count(outcome.bottleneck.meetings.length, 'meeting', 'meetings')} can only use ${count(outcome.bottleneck.slots.length, 'slot', 'slots')}:` +
            `\n  meetings: ${outcome.bottleneck.meetings.join(', ')}` +
            `\n  slots:    ${outcome.bottleneck.slots.join(', ')}`}
        </Text>
      )}
    </Stack>
  );
};

const ResultView: React.FC<RequestResult> = ({ outcome, plan }) => {
  if (!outcome.scheduled || !plan) {
    return <FailureView outcome={outcome} />;
  }

  return (
    <Stack spacing={1}>
      <Text variant="h6">
        {`Scheduled ${count(plan.scheduled.length, 'meeting', 'meetings')} via ${outcome.method}`}
      </Text>
      {plan.scheduled.map((entry) => (
        <Text key={entry.meeting.id} component="pre" margin={0}>
          {`${entry.meeting.attendees.join(', ')}  →  ${entry.slot.id}`}
        </Text>
      ))}
      {plan.dropped.length > 0 && (
        <Text color="text.secondary">
          {`Not scheduled: ${plan.dropped.map((meeting) => meeting.id).join(', ')}`}
        </Text>
      )}
      {outcome.softViolation !== undefined && (
        <Text color="text.secondary">
          {`Preference cost: ${outcome.softViolation.toFixed(4)}`}
        </Text>
      )}
    </Stack>
  );
};

export default MeetingSchedulerClient;
