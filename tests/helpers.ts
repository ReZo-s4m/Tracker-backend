import { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

let mongod: MongoMemoryServer;
let counter = 0;

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function teardownTestDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function signupUser(app: Express, overrides: Record<string, unknown> = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test User', email: `user${counter}@example.com`, password: 'password123', ...overrides });
  return res.body as { token: string; user: { id: string; name: string; email: string } };
}
