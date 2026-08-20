import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config';
import { Task } from '../models/Task';
import { User } from '../models/User';

const VERBS = ['Write', 'Review', 'Update', 'Fix', 'Plan', 'Draft', 'Ship', 'Test', 'Refactor', 'Document'];
const OBJECTS = [
  'the onboarding flow',
  'Q3 report',
  'API docs',
  'landing page copy',
  'sprint backlog',
  'billing bug',
  'deploy pipeline',
  'user survey',
  'design tokens',
  'search index',
];
const DESCRIPTIONS = [
  'Carry over from last week.',
  'Blocked on review feedback.',
  'Needs sign-off before Friday.',
  'Low effort, quick win.',
  'Coordinate with the platform team first.',
  '',
];
const STATUSES = ['todo', 'todo', 'todo', 'in_progress', 'in_progress', 'done', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;

const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  await mongoose.connect(config.mongoUri);

  const email = 'demo@example.com';
  const user =
    (await User.findOne({ email })) ??
    (await User.create({ name: 'Demo User', email, passwordHash: await bcrypt.hash('password123', 10) }));

  await Task.deleteMany({ userId: user._id });

  const tasks = Array.from({ length: 50 }, (_, i) => ({
    userId: user._id,
    title: `${pick(VERBS)} ${pick(OBJECTS)} #${i + 1}`,
    description: pick(DESCRIPTIONS),
    status: pick(STATUSES),
    priority: pick(PRIORITIES),
    dueDate: Math.random() < 0.2 ? null : new Date(Date.now() + Math.round(Math.random() * 60 - 15) * DAY),
  }));
  await Task.insertMany(tasks);

  console.log(`Seeded ${tasks.length} tasks for ${email} / password123`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
