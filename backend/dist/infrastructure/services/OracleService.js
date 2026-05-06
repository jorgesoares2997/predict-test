"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OracleService = void 0;
class OracleService {
    async fetchResultFromSource(sourceUrl) {
        try {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch from ${sourceUrl}: ${response.statusText}`);
            }
            const data = await response.json();
            // Implement specific parsing logic here based on the data structure returned by the resolution_source
            // For demonstration, we assume the API returns { "winningResultName": "Yes" }
            if (data && data.winningResultName) {
                return data.winningResultName;
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching oracle data from ${sourceUrl}:`, error);
            return null;
        }
    }
}
exports.OracleService = OracleService;
