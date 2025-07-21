const waterContainerRepository = require('../models/waterContainerRepository');
const { log } = require('../config/logging');

const VALID_UNITS = ['ml', 'oz', 'cup'];

function convertToMl(volume, unit) {
    if (!VALID_UNITS.includes(unit)) {
        throw new Error('Invalid unit for conversion.');
    }
    switch (unit) {
        case 'oz':
            return volume * 29.5735; // Standard US fluid ounce
        case 'cup':
            return volume * 240; // Standard US cup
        case 'ml':
        default:
            return volume;
    }
}

async function createWaterContainer(userId, containerData) {
    if (!VALID_UNITS.includes(containerData.unit)) {
        throw new Error('Invalid unit provided.');
    }
    try {
        return await waterContainerRepository.createWaterContainer(userId, containerData);
    } catch (error) {
        log('error', `Error creating water container for user ${userId}:`, error);
        throw error;
    }
}

async function getWaterContainersByUserId(userId) {
    try {
        return await waterContainerRepository.getWaterContainersByUserId(userId);
    } catch (error) {
        log('error', `Error fetching water containers for user ${userId}:`, error);
        throw error;
    }
}

async function updateWaterContainer(id, userId, updateData) {
    if (updateData.unit && !VALID_UNITS.includes(updateData.unit)) {
        throw new Error('Invalid unit provided.');
    }
    try {
        // Add authorization check if needed, e.g., ensuring user owns the container
        return await waterContainerRepository.updateWaterContainer(id, userId, updateData);
    } catch (error) {
        log('error', `Error updating water container ${id} for user ${userId}:`, error);
        throw error;
    }
}

async function deleteWaterContainer(id, userId) {
    try {
        // Add authorization check if needed
        const success = await waterContainerRepository.deleteWaterContainer(id, userId);
        if (!success) {
            throw new Error('Water container not found or not authorized to delete.');
        }
        return { message: 'Water container deleted successfully.' };
    } catch (error) {
        log('error', `Error deleting water container ${id} for user ${userId}:`, error);
        throw error;
    }
}

async function setPrimaryWaterContainer(id, userId) {
    try {
        // Add authorization check if needed
        return await waterContainerRepository.setPrimaryWaterContainer(id, userId);
    } catch (error) {
        log('error', `Error setting primary water container ${id} for user ${userId}:`, error);
        throw error;
    }
}

module.exports = {
    createWaterContainer,
    getWaterContainersByUserId,
    updateWaterContainer,
    deleteWaterContainer,
    setPrimaryWaterContainer,
    convertToMl,
};