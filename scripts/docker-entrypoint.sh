#!/bin/sh
set -e

echo "[entrypoint] preparing upload directory"
mkdir -p "${UPLOAD_DIR:-data/uploads}"

echo "[entrypoint] waiting for MongoDB"
node <<'NODE'
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/askmynotes';
let attempts = 0;

(async () => {
  while (attempts < 30) {
    attempts += 1;
    try {
      await mongoose.connect(uri, { dbName: 'askmynotes' });
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.log(`[entrypoint] mongo not ready (attempt ${attempts}/30)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error('[entrypoint] mongo connection failed');
  process.exit(1);
})();
NODE

echo "[entrypoint] seeding demo user"
npm run seed
