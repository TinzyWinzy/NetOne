import { randomBytes, scryptSync } from 'node:crypto';
const { NETONE_ACCOUNT_NAME: username, NETONE_ACCOUNT_ROLE: role, NETONE_ACCOUNT_PASSWORD: password } = process.env;
if (!username || !['Executive', 'Finance', 'Network', 'Regulatory', 'Admin'].includes(role) || !password || password.length < 12) throw new Error('Provide an account name, valid role and password of at least 12 characters in NETONE_ACCOUNT_* environment variables.');
const salt = randomBytes(16).toString('hex');
console.log(JSON.stringify({ username, role, salt, hash: scryptSync(password, salt, 32).toString('hex') }));
