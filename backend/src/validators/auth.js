const { z } = require('zod');

// US-01: Login Schema
const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

// US-01: Create User Schema (Admin only)
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER', 'BUYER'], {
    errorMap: () => ({ message: 'Role must be one of: ADMIN, MANAGER, STAFF, SUPPLIER, BUYER' }),
  }),
});

module.exports = {
  loginSchema,
  createUserSchema,
};
