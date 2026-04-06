import { z } from 'zod';

export const reelStatusSchema = z.enum([
  'pending',
  'downloading',
  'ocr',
  'generating',
  'rendering',
  'ready',
  'publishing',
  'published',
  'error',
]);

export const reelSchema = z.object({
  id: z.string().min(1),
  sourceUrl: z.string().min(1),
  telegramChatId: z.string().nullable(),
  telegramMessageId: z.string().nullable(),
  status: reelStatusSchema,
  originalText: z.string().nullable(),
  customText: z.string().nullable(),
  generatedText: z.string().nullable(),
  finalText: z.string().nullable(),
  textRegionX: z.number().int().nullable(),
  textRegionY: z.number().int().nullable(),
  textRegionW: z.number().int().nullable(),
  textRegionH: z.number().int().nullable(),
  originalVideo: z.string().nullable(),
  processedVideo: z.string().nullable(),
  thumbnail: z.string().nullable(),
  publishedProfileId: z.string().nullable(),
  publishedPlatform: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publishError: z.string().nullable(),
  errorMessage: z.string().nullable(),
  errorStage: z.string().nullable(),
  retryCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createReelInputSchema = z.object({
  sourceUrl: z.string().url(),
  customText: z.string().trim().optional(),
  telegramChatId: z.string().optional(),
  telegramMessageId: z.string().optional(),
});

export const updateReelTextSchema = z.object({
  text: z.string().trim().min(1),
});

export const publishReelInputSchema = z.object({
  profileId: z.string().min(1),
  platform: z.enum(['youtube', 'instagram']),
});

export type ReelStatus = z.infer<typeof reelStatusSchema>;
export type Reel = z.infer<typeof reelSchema>;
export type CreateReelInput = z.infer<typeof createReelInputSchema>;
export type UpdateReelTextInput = z.infer<typeof updateReelTextSchema>;
export type PublishReelInput = z.infer<typeof publishReelInputSchema>;
