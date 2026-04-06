import { z } from 'zod';

export const managedProfilePlatformSchema = z.enum(['youtube', 'instagram']);

export const managedProfileSchema = z.object({
  id: z.string().min(1),
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable(),
  profileDir: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createManagedProfileSchema = z.object({
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable().optional(),
});

export const updateManagedProfileSchema = z.object({
  id: z.string().min(1),
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable(),
});

export type ManagedProfilePlatform = z.infer<typeof managedProfilePlatformSchema>;
export type ManagedProfile = z.infer<typeof managedProfileSchema>;
export type CreateManagedProfileInput = z.infer<typeof createManagedProfileSchema>;
export type UpdateManagedProfileInput = z.infer<typeof updateManagedProfileSchema>;
