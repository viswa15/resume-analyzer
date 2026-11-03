// backend/validators/authValidators.js
const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Please provide a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

module.exports = { registerSchema, loginSchema };
