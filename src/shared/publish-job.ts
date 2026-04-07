import { z } from 'zod';

export const publishJobStatusSchema = z.enum([
  'pending',
  'scheduled',
  'publishing',
  'published',
  'error',
]);

export const publishJobSchema = z.object({
  id: z.string().min(1),
  reelId: z.string().min(1),
  profileId: z.string().min(1),
  platform: z.enum(['youtube', 'instagram']),
  status: publishJobStatusSchema,
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createPublishJobSchema = z.object({
  reelId: z.string().min(1),
  profileId: z.string().min(1),
  platform: z.enum(['youtube', 'instagram']),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const createBatchPublishJobsSchema = z.object({
  reelIds: z.array(z.string().min(1)).min(1),
  profileId: z.string().min(1),
  platform: z.enum(['youtube', 'instagram']),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export type PublishJobStatus = z.infer<typeof publishJobStatusSchema>;
export type PublishJob = z.infer<typeof publishJobSchema>;
export type CreatePublishJobInput = z.infer<typeof createPublishJobSchema>;
export type CreateBatchPublishJobsInput = z.infer<typeof createBatchPublishJobsSchema>;
