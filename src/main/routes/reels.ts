import { Router } from 'express';

import {
  createReelInputSchema,
  updateReelTextSchema,
  updateRegionsSchema,
  publishReelInputSchema,
} from '../../shared/reel.js';
import {
  listReels,
  getReelById,
  createReel,
  updateReelText,
  updateReelStatus,
  deleteReel,
} from '../services/reel-repository.js';
import { enqueueReel } from '../services/processing-queue.js';

const router = Router();

router.get('/', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const reels = listReels(status);
  res.json({ reels });
});

router.get('/:id', (req, res) => {
  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }
  res.json({ reel });
});

router.post('/', (req, res) => {
  const parsed = createReelInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const reel = createReel(parsed.data);
  enqueueReel(reel.id);
  res.status(201).json({ reel });
});

router.put('/:id/text', (req, res) => {
  const parsed = updateReelTextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const reel = updateReelText(req.params.id, parsed.data.text);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }
  res.json({ reel });
});

router.put('/:id/regions', (req, res) => {
  const parsed = updateRegionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }

  updateReelStatus(reel.id, reel.status as any, {
    detectedRegions: JSON.stringify(parsed.data.regions),
  });
  res.json({ reel: getReelById(reel.id) });
});

router.post('/:id/approve', (req, res) => {
  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }

  if (reel.status !== 'review') {
    res.status(400).json({ error: 'Reel is not in review state' });
    return;
  }

  // Resume pipeline from generating stage
  updateReelStatus(reel.id, 'generating');
  enqueueReel(reel.id, 'generating');
  res.json({ reel: getReelById(reel.id) });
});

router.post('/:id/rerender', (req, res) => {
  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }

  updateReelStatus(reel.id, 'rendering');
  enqueueReel(reel.id, 'rendering');
  res.json({ reel: getReelById(reel.id) });
});

router.post('/:id/publish', (req, res) => {
  const parsed = publishReelInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }

  if (reel.status !== 'ready') {
    res.status(400).json({ error: 'Reel is not ready for publishing' });
    return;
  }

  updateReelStatus(reel.id, 'publishing', {
    publishedProfileId: parsed.data.profileId,
    publishedPlatform: parsed.data.platform,
  });

  res.json({ reel: getReelById(reel.id) });
});

router.post('/:id/retry', (req, res) => {
  const reel = getReelById(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }

  if (reel.status !== 'error') {
    res.status(400).json({ error: 'Reel is not in error state' });
    return;
  }

  const retryFrom = reel.errorStage || 'pending';
  updateReelStatus(reel.id, retryFrom as any, {
    errorMessage: null,
    errorStage: null,
  });
  enqueueReel(reel.id, retryFrom);
  res.json({ reel: getReelById(reel.id) });
});

router.delete('/:id', (req, res) => {
  const deleted = deleteReel(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }
  res.json({ success: true });
});

export { router as reelsRouter };
