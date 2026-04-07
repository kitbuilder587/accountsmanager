import { z } from 'zod';

export const managedProfilePlatformSchema = z.enum(['youtube', 'instagram']);
export const profileStatusSchema = z.enum(['active', 'suspended', 'banned']);
export const loginStatusSchema = z.enum(['logged_in', 'logged_out', 'needs_reauth']);

export const managedProfileSchema = z.object({
  id: z.string().min(1),
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable(),
  profileDir: z.string().trim().min(1),
  proxy: z.string().trim().nullable(),
  fingerprint: z.string().trim().nullable(),
  status: profileStatusSchema,
  loginStatus: loginStatusSchema,
  avatarUrl: z.string().trim().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createManagedProfileSchema = z.object({
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable().optional(),
  proxy: z.string().trim().nullable().optional(),
});

export const updateManagedProfileSchema = z.object({
  id: z.string().min(1),
  platform: managedProfilePlatformSchema,
  accountLabel: z.string().trim().min(1),
  note: z.string().trim().nullable(),
  proxy: z.string().trim().nullable().optional(),
  status: profileStatusSchema.optional(),
  loginStatus: loginStatusSchema.optional(),
});

export type ManagedProfilePlatform = z.infer<typeof managedProfilePlatformSchema>;
export type ProfileStatus = z.infer<typeof profileStatusSchema>;
export type LoginStatus = z.infer<typeof loginStatusSchema>;
export type ManagedProfile = z.infer<typeof managedProfileSchema>;
export type CreateManagedProfileInput = z.infer<typeof createManagedProfileSchema>;
export type UpdateManagedProfileInput = z.infer<typeof updateManagedProfileSchema>;
