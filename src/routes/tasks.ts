import { Router } from 'express';
import { completeTask, createTask, deleteTask, getTask, listTasks, taskStats, updateTask } from '../controllers/tasks';
import { requireAuth } from '../middleware/auth';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);
tasksRouter.get('/stats', taskStats);
tasksRouter.get('/', listTasks);
tasksRouter.post('/', createTask);
tasksRouter.get('/:id', getTask);
tasksRouter.put('/:id', updateTask);
tasksRouter.patch('/:id/complete', completeTask);
tasksRouter.delete('/:id', deleteTask);
