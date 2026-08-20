import { Router } from 'express';
import { login, me, signup } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();
authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.get('/me', requireAuth, me);
