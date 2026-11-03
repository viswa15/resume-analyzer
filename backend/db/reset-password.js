// backend/db/reset-password.js
//
// Local admin tool: sets a new password on an existing account, keeping all of
// that user's resumes, chats and applications. Passwords are stored as one-way
// bcrypt hashes, so an old password can never be looked up - only replaced.
//
// Usage (from the backend folder, with your .env pointing at the database):
//   npm run reset-password -- --list                 show the emails that exist
//   npm run reset-password -- you@example.com        prompts for the new password (hidden)
//
// For scripts/CI you can supply the password via the RESET_PASSWORD env var instead of
// the prompt. Prefer the prompt for real use so the password never lands in shell history.
const bcrypt = require('bcryptjs');

const MIN_PASSWORD_LENGTH = 8; // same rule as registration (validators/authValidators.js)
const SALT_ROUNDS = 10;

/**
 * @param {{ query: Function }} db
 * @returns {Promise<{ id: number, email: string } | null>} the updated user, or null if no such email
 */
const resetPassword = async (db, email, password) => {
  if (!email || typeof email !== 'string') throw new Error('An email address is required.');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query(
    'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, email;',
    [hash, email.trim()]
  );
  return rows[0] || null;
};

const listEmails = async (db) => {
  const { rows } = await db.query('SELECT email, name, created_at FROM users ORDER BY created_at ASC;');
  return rows;
};

// Reads one line from the terminal without echoing it.
const promptHidden = (question) =>
  new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (!muted) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });

const main = async () => {
  const args = process.argv.slice(2);
  const db = require('./index'); // required lazily so importing this file in tests opens no pool

  try {
    if (args.includes('--list')) {
      const users = await listEmails(db);
      if (!users.length) console.log('No accounts found in this database.');
      users.forEach((u) => console.log(`${u.email}${u.name ? `  (${u.name})` : ''}`));
      return;
    }

    const email = args.find((a) => !a.startsWith('--'));
    if (!email) {
      console.error('Usage: npm run reset-password -- <email>   (or --list to see accounts)');
      process.exitCode = 1;
      return;
    }

    let password = process.env.RESET_PASSWORD;
    if (!password) {
      if (!process.stdin.isTTY) throw new Error('No terminal available. Set RESET_PASSWORD or run this in an interactive terminal.');
      password = await promptHidden('New password: ');
      const confirm = await promptHidden('Confirm new password: ');
      if (password !== confirm) throw new Error('The two passwords did not match. Nothing was changed.');
    }

    const user = await resetPassword(db, email, password);
    if (!user) {
      console.error(`No account found for "${email}". Run with --list to see the accounts in this database.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Password updated for ${user.email}. You can sign in with it now.`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
};

if (require.main === module) main();

module.exports = { resetPassword, listEmails };
