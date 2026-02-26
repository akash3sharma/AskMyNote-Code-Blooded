/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/askmynotes';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function seed() {
  await mongoose.connect(uri, { dbName: 'askmynotes' });

  const email = 'demo@askmynotes.com';
  const password = 'Demo@1234';
  const passwordHash = await bcrypt.hash(password, 12);

  await User.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        passwordHash,
      },
    },
    { upsert: true }
  );

  console.log(`[seed] demo user ready: ${email}`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
