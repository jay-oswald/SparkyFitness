const path = require('path');
const fs = require('fs');
const https = require('https'); // Import https module

class VersionService {
    getAppVersion() {
        try {
            const packageJsonPath = path.join(__dirname, '../../package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version;
        } catch (error) {
            console.error('Error reading package.json:', error);
            return 'unknown';
        }
    }

    // Helper function to compare versions (e.g., "1.0.0" vs "1.0.1")
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1; // v1 is newer
            if (p1 < p2) return -1; // v2 is newer
        }
        return 0; // versions are equal
    }

    async getLatestGitHubRelease() {
        const repoOwner = 'CodeWithCJ';
        const repoName = 'SparkyFitness';
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;

        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'SparkyFitness-App' // GitHub API requires a User-Agent header
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const release = JSON.parse(data);
                        if (res.statusCode === 200) {
                            const currentAppVersion = this.getAppVersion();
                            const latestGitHubVersion = release.tag_name.startsWith('v') ? release.tag_name.substring(1) : release.tag_name; // Remove 'v' prefix if present

                            const isNewVersionAvailable = this.compareVersions(latestGitHubVersion, currentAppVersion) > 0;

                            resolve({
                                version: release.tag_name,
                                releaseNotes: release.body,
                                publishedAt: release.published_at,
                                htmlUrl: release.html_url,
                                isNewVersionAvailable: isNewVersionAvailable
                            });
                        } else {
                            reject(new Error(`GitHub API error: ${release.message || 'Unknown error'}`));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse GitHub API response.'));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
}

module.exports = new VersionService();