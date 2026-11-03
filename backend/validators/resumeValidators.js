// backend/validators/resumeValidators.js
const { z } = require('zod');

const jdMatchSchema = z.object({
  jobDescription: z
    .string()
    .min(30, 'Please paste a fuller job description (at least 30 characters).'),
});

const chatSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty.').max(2000),
});

const rewriteSchema = z.object({
  bullet: z.string().min(1, 'Bullet point text is required.').max(1000),
  role: z.string().max(255).optional(),
});

const coverLetterSchema = z.object({
  jobDescription: z
    .string()
    .min(30, 'Please paste a fuller job description (at least 30 characters).'),
  companyName: z.string().max(255).optional(),
  tone: z.enum(['professional', 'enthusiastic', 'concise']).optional(),
});

// jobDescription is optional here: without one the checker only audits resume
// structure; with one it also reports keyword coverage against that JD.
const atsSchema = z.object({
  jobDescription: z.string().max(20000).optional(),
});

const tailorSchema = z.object({
  jobDescription: z
    .string()
    .min(30, 'Please paste a fuller job description (at least 30 characters).')
    .max(20000),
});

// The document the PDF endpoint renders. It comes from the client (so the user can
// export an edited version), which is why every field is length-capped.
const text = (max) => z.string().max(max).default('');
const list = (max, item) => z.array(item).max(max).default([]);
const tailoredDocumentSchema = z.object({
  document: z.object({
    contact: z.object({ name: text(200), email: text(200), phone: text(60), linkedin: text(300), portfolio: text(300) }),
    headline: text(300),
    summary: text(2000),
    skills: list(80, z.string().max(100)),
    work_experience: list(20, z.object({ role: text(200), company: text(200), duration: text(100), bullets: list(20, z.string().max(800)) })),
    education: list(10, z.object({ degree: text(200), institution: text(200), year: text(50) })),
    projects: list(15, z.object({ name: text(200), description: text(1200), technologies: list(30, z.string().max(80)) })),
    certifications: list(20, z.string().max(300)),
  }),
});

module.exports = { jdMatchSchema, chatSchema, rewriteSchema, coverLetterSchema, atsSchema, tailorSchema, tailoredDocumentSchema };
