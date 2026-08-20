import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/task_tracker',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
};