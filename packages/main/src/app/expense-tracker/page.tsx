import type { Metadata } from 'next';
import ExpenseTrackerClient from './ExpenseTrackerClient';

export const metadata: Metadata = {
  title: 'Expense Tracker | SwiftPost',
  description: 'Complete personal finance management system.',
};

export default function ExpenseTrackerPage() {
  return <ExpenseTrackerClient />;
}
