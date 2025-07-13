const { log } = require('../../config/logging');
const NodeCache = require('node-cache');

const WGER_API_BASE_URL = 'https://wger.de/api/v2';
const WGER_CACHE_DURATION_SECONDS = 3600; // Cache for 1 hour
const wgerCache = new NodeCache({ stdTTL: WGER_CACHE_DURATION_SECONDS });

async function callWgerApi(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${WGER_API_BASE_URL}${endpoint}/?${queryString}`;

    // Check cache first
    const cacheKey = url;
    const cachedData = wgerCache.get(cacheKey);
    if (cachedData) {
        log('info', `Returning cached data for Wger API: ${url}`);
        return cachedData;
    }

    try {
        log('info', `Calling Wger API: ${url}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('error', `Wger API error for ${endpoint}: ${response.status} - ${errorText}`);
            throw new Error(`Wger API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        wgerCache.set(cacheKey, data); // Cache the response
        return data;
    } catch (error) {
        log('error', `Error calling Wger API ${endpoint}:`, error);
        throw error;
    }
}

async function searchWgerExercises(query, language = 'en', limit = 10, offset = 0) {
    const params = {
        language: language,
        term: query,
        limit: limit,
        offset: offset,
    };
    // Use /exercise/ endpoint for search by name/term
    const data = await callWgerApi('/exercise', params);
    return data.results; // wger returns results in a 'results' array
}

async function getWgerExerciseDetails(exerciseId) {
    // Use /exerciseinfo/ endpoint for detailed information
    const data = await callWgerApi(`/exerciseinfo/${exerciseId}`);
    return data;
}

module.exports = {
    searchWgerExercises,
    getWgerExerciseDetails,
};