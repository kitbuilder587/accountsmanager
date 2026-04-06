import { Router } from 'express';

import {
  createManagedProfileSchema,
  updateManagedProfileSchema,
} from '../../shared/profile.js';
import {
  listProfiles,
  createProfile,
  updateProfile,
} from '../services/profile-repository.js';

const router = Router();

router.get('/', (_req, res) => {
  const profiles = listProfiles();
  res.json({ profiles });
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
    res.status(404).json({ error: 'Profile not found' });
  }
});

export { router as profilesRouter };
