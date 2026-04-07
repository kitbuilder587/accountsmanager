import { Router } from 'express';

import {
  createPublishJobSchema,
  createBatchPublishJobsSchema,
} from '../../shared/publish-job.js';
import {
  listPublishJobs,
  getPublishJobById,
  getPublishJobsByReelId,
  createPublishJob,
  createBatchPublishJobs,
  updatePublishJobStatus,
  deletePublishJob,
} from '../services/publish-job-repository.js';

const router = Router();

router.get('/', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const jobs = listPublishJobs(status);
  res.json({ jobs });
});

router.get('/:id', (req, res) => {
  const job = getPublishJobById(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Publish job not found' });
    return;
  }
  res.json({ job });
});

router.get('/reel/:reelId', (req, res) => {
  const jobs = getPublishJobsByReelId(req.params.reelId);
  res.json({ jobs });
});

router.post('/', (req, res) => {
  const parsed = createPublishJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const job = createPublishJob(parsed.data);
  res.status(201).json({ job });
});

router.post('/batch', (req, res) => {
  const parsed = createBatchPublishJobsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    return;
  }

  const jobs = createBatchPublishJobs(
    parsed.data.reelIds,
    parsed.data.profileId,
    parsed.data.platform,
    parsed.data.scheduledAt,
  );
  res.status(201).json({ jobs });
});

router.post('/:id/retry', (req, res) => {
  const job = getPublishJobById(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Publish job not found' });
    return;
  }

  if (job.status !== 'error') {
    res.status(400).json({ error: 'Job is not in error state' });
    return;
  }

  const updated = updatePublishJobStatus(job.id, 'pending', { errorMessage: null });
  res.json({ job: updated });
});

router.delete('/:id', (req, res) => {
  const deleted = deletePublishJob(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Publish job not found' });
    return;
  }
  res.json({ success: true });
});

export { router as publishJobsRouter };
