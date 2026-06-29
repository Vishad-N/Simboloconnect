/**
 * metrics.js
 * Phase B — Exposes telemetry stats and queue lengths to Prometheus / health collectors.
 */
const express = require('express');
const router = express.Router();
const ObservabilityManager = require('../services/monitoring/ObservabilityManager');

// Route guarded by basic telemetry auth if configured
router.get('/', async (req, res) => {
    const FEATURE_MONITORING = process.env.FEATURE_MONITORING === 'true';
    if (!FEATURE_MONITORING) {
        return res.status(501).send('Telemetry monitoring is disabled.');
    }

    try {
        res.set('Content-Type', ObservabilityManager.getContentType());
        const metrics = await ObservabilityManager.getMetrics();
        res.end(metrics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
