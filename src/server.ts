import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  const app = createApp();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`API listening on :${config.port}`);
  });

  mongoose.connect(config.mongoUri).catch((err) => {
    console.error('MongoDB connection failed', err);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});