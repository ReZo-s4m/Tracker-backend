import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongoUri);

  createApp().listen(config.port, '0.0.0.0', () => {
    console.log(`API listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});