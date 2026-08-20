import { Types } from 'mongoose';
import { ApiError, asyncHandler } from '../errors';
import { Task } from '../models/Task';
import { createTaskSchema, listTasksSchema, updateTaskSchema } from '../schemas/task';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findOwnedTask(userId: string, id: unknown) {
  const notFound = () => new ApiError(404, 'Task not found', 'TASK_NOT_FOUND');
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw notFound();
  const task = await Task.findOne({ _id: id, userId });
  if (!task) throw notFound();
  return task;
}

export const taskStats = asyncHandler(async (req, res) => {
  const [row] = await Task.aggregate([
    { $match: { userId: new Types.ObjectId(req.userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', '$$NOW'] },
                  { $ne: ['$status', 'done'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const total = row?.total ?? 0;
  const done = row?.done ?? 0;
  res.json({
    total,
    byStatus: { todo: row?.todo ?? 0, in_progress: row?.inProgress ?? 0, done },
    completed: done,
    pending: total - done,
    completionPercentage: total === 0 ? 0 : Math.round((done / total) * 100),
    overdue: row?.overdue ?? 0,
  });
});

export const listTasks = asyncHandler(async (req, res) => {
  const q = listTasksSchema.parse(req.query);
  const match: Record<string, unknown> = { userId: new Types.ObjectId(req.userId) };
  if (q.status) match.status = q.status;
  if (q.priority) match.priority = q.priority;
  if (q.search) match.title = { $regex: escapeRegex(q.search), $options: 'i' };

  const sortField = q.sortBy === 'priority' ? 'priorityRank' : q.sortBy;
  const order = q.order === 'asc' ? 1 : -1;

  const [result] = await Task.aggregate([
    { $match: match },
    { $addFields: { priorityRank: { $indexOfArray: [['low', 'medium', 'high'], '$priority'] } } },
    { $sort: { [sortField]: order, _id: 1 } },
    {
      $facet: {
        tasks: [
          { $skip: (q.page - 1) * q.limit },
          { $limit: q.limit },
          { $project: { priorityRank: 0 } },
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ]);

  const total: number = result.meta[0]?.total ?? 0;
  res.json({ tasks: result.tasks, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
});

export const createTask = asyncHandler(async (req, res) => {
  const body = createTaskSchema.parse(req.body);
  const task = await Task.create({ ...body, userId: req.userId });
  res.status(201).json({ task });
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  res.json({ task });
});

export const updateTask = asyncHandler(async (req, res) => {
  const body = updateTaskSchema.parse(req.body);
  const task = await findOwnedTask(req.userId as string, req.params.id);
  Object.assign(task, body);
  await task.save();
  res.json({ task });
});

export const completeTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  task.status = 'done';
  await task.save();
  res.json({ task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  await task.deleteOne();
  res.status(204).end();
});
