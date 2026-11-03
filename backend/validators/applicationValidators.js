// backend/validators/applicationValidators.js
const { z } = require('zod');

const STATUS_VALUES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

const createApplicationSchema = z.object({
  company: z.string().min(1, 'Company name is required.').max(255),
  roleTitle: z.string().min(1, 'Role title is required.').max(255),
  jobUrl: z.string().max(1000).url('Job URL must be a valid URL.').optional().or(z.literal('')),
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().max(4000).optional(),
  appliedAt: z.string().max(30).optional(),
  resumeId: z.union([z.string(), z.number()]).optional(),
});

const updateApplicationSchema = createApplicationSchema.partial();

module.exports = { createApplicationSchema, updateApplicationSchema, STATUS_VALUES };
