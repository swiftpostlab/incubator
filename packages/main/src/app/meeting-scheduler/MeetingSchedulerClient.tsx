'use client';

import { useState } from 'react';

import BasePageTemplate from '@/templates/BasePageTemplate';
import Button from '@swiftpost/elysium/ui/base/Button';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import TextField from '@swiftpost/elysium/ui/base/TextField ';
import {
  InputError,
  describeSchedule,
  solveRequest,
} from '@swiftpost/genetic-solver';
import type { RunOutcome, Schedule } from '@swiftpost/genetic-solver';

/**
 * The example is the documentation. It is deliberately solvable but tight, so
 * deleting one availability shows the infeasible path without any other edit.
 */
const exampleSpec = `{
  "days": ["mon", "tue"],
  "slotsPerDay": 3,
  "people": [
    { "id": "ana", "availableSlotIds": ["mon#0", "mon#1"] },
    { "id": "bo", "availableSlotIds": ["mon#1", "tue#0"] },
    { "id": "cy", "availableSlotIds": ["tue#0", "tue#2"] }
  ],
  "preferences": { "compactDaysWeight": 0, "earlinessWeight": 0 }
}`;

interface Result {
  readonly outcome: RunOutcome;
  readonly schedule?: Schedule;
}

/** "1 slot" rather than "1 slots" — the bottleneck line reads as a sentence. */
const count = (value: number, singular: string, plural: string): string =>
  `${String(value)} ${value === 1 ? singular : plural}`;

const MeetingSchedulerClient: React.FC = () => {
  const [spec, setSpec] = useState(exampleSpec);
  const [result, setResult] = useState<Result | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSolve = () => {
    try {
      const { spec: parsed, outcome } = solveRequest(spec);

      setResult({
        outcome,
        schedule:
          outcome.assignment && describeSchedule(parsed, outcome.assignment),
      });
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
            Give everyone a one-to-one meeting without booking anybody when they
            are unavailable. With no preferences this is exact: a schedule is
            guaranteed valid, and a failure is a proof that none exists.
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
          <Button
            onClick={() => {
              setSpec(exampleSpec);
              setResult(undefined);
              setError(undefined);
            }}
          >
            Reset
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

const ResultView: React.FC<Result> = ({ outcome, schedule }) => {
  if (!outcome.scheduled) {
    return (
      <Stack spacing={1}>
        <Text variant="h6">No schedule exists</Text>
        <Text color="text.secondary">
          This is a proof, not a failed search.
        </Text>
        {outcome.bottleneck && (
          <Text component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {`${count(outcome.bottleneck.people.length, 'person', 'people')} can only attend ${count(outcome.bottleneck.slots.length, 'slot', 'slots')}:` +
              `\n  people: ${outcome.bottleneck.people.join(', ')}` +
              `\n  slots:  ${outcome.bottleneck.slots.join(', ')}`}
          </Text>
        )}
      </Stack>
    );
  }

  const meetings = [...(schedule?.meetings ?? [])].sort(
    (left, right) => left.slot.index - right.slot.index,
  );

  return (
    <Stack spacing={1}>
      <Text variant="h6">
        {`Scheduled ${String(meetings.length)} meetings via ${outcome.method}`}
      </Text>
      {meetings.map((meeting) => (
        <Text key={meeting.person.id} component="pre" margin={0}>
          {`${meeting.person.id}  →  ${meeting.slot.id}`}
        </Text>
      ))}
      {outcome.softViolation !== undefined && (
        <Text color="text.secondary">
          {`Preference cost: ${outcome.softViolation.toFixed(4)}`}
        </Text>
      )}
    </Stack>
  );
};

export default MeetingSchedulerClient;
