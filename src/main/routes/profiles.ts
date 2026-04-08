import { Router } from 'express';

import {
  createManagedProfileSchema,
  updateManagedProfileSchema,
} from '../../shared/profile.js';
import {
  listProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../services/profile-repository.js';

const router = Router();

router.get('/', (_req, res) => {
  const profiles = listProfiles();
  res.json({ profiles });
});

router.get('/:id', (req, res) => {
  const profile = getProfileById(req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({ profile });
});

router.post('/', (req, res) => {
  const parsed = createManagedProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const profile = createProfile(parsed.data);
  res.status(201).json({ profile });
});

router.put('/:id', (req, res) => {
  const parsed = updateManagedProfileSchema.safeParse({
    ...req.body,
    id: req.params.id,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  try {
    const profile = updateProfile(parsed.data);
    res.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      console.error('[Profiles] Update error:', message);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
});

router.delete('/:id', (req, res) => {
  const deleted = deleteProfile(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({ success: true });
});

export { router as profilesRouter };
