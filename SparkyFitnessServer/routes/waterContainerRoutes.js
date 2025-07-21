const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const waterContainerService = require('../services/waterContainerService');

// Create a new water container
router.post('/', authenticateToken, authorizeAccess('water_containers'), async (req, res, next) => {
    try {
        const container = await waterContainerService.createWaterContainer(req.userId, req.body);
        res.status(201).json(container);
    } catch (error) {
        next(error);
    }
});

// Get all water containers for the logged-in user
router.get('/', authenticateToken, authorizeAccess('water_containers'), async (req, res, next) => {
    try {
        const containers = await waterContainerService.getWaterContainersByUserId(req.userId);
        res.status(200).json(containers);
    } catch (error) {
        next(error);
    }
});

// Update a water container
router.put('/:id', authenticateToken, authorizeAccess('water_containers'), async (req, res, next) => {
    try {
        const container = await waterContainerService.updateWaterContainer(req.params.id, req.userId, req.body);
        if (!container) {
            return res.status(404).json({ error: 'Container not found or not authorized.' });
        }
        res.status(200).json(container);
    } catch (error) {
        next(error);
    }
});

// Delete a water container
router.delete('/:id', authenticateToken, authorizeAccess('water_containers'), async (req, res, next) => {
    try {
        const result = await waterContainerService.deleteWaterContainer(req.params.id, req.userId);
        res.status(200).json(result);
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
});

// Set a container as the primary one for quick logging
router.put('/:id/set-primary', authenticateToken, authorizeAccess('water_containers'), async (req, res, next) => {
    try {
        const container = await waterContainerService.setPrimaryWaterContainer(req.params.id, req.userId);
        if (!container) {
            return res.status(404).json({ error: 'Container not found or not authorized.' });
        }
        res.status(200).json(container);
    } catch (error) {
        next(error);
    }
});

module.exports = router;