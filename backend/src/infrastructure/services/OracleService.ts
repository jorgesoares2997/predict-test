import { IOracleService } from '../../application/ports';

export class OracleService implements IOracleService {
  async fetchResultFromSource(sourceUrl: string): Promise<string | null> {
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
    } catch (error) {
      console.error(`Error fetching oracle data from ${sourceUrl}:`, error);
      return null;
    }
  }
}
