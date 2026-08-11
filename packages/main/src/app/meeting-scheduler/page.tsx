import type { Metadata } from 'next';
import MeetingSchedulerClient from './MeetingSchedulerClient';

export const metadata: Metadata = {
  title: 'Meeting Scheduler | SwiftPost',
  description:
    'Assign one-to-one meetings to slots, exactly, or prove no schedule exists.',
};

export default function MeetingSchedulerPage() {
  return <MeetingSchedulerClient />;
}
