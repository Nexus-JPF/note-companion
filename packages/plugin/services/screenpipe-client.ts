export interface ScreenpipeSearchParams {
  q?: string;
  content_type?: "all" | "ocr" | "audio";
  limit?: number;
  start_time?: string;
  end_time?: string;
  app_name?: string;
  window_name?: string;
}

export interface ScreenpipeResult {
  type: "OCR" | "Audio";
  content: {
    text?: string;
    transcription?: string;
    timestamp: string;
    app_name?: string;
    window_name?: string;
    file_path?: string;
    audio_file_path?: string;
  };
}

export class ScreenpipeClient {
  constructor(private apiUrl: string = "http://localhost:3030") {}

  /**
   * Check if ScreenPipe API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Search ScreenPipe for recorded content
   */
  async search(params: ScreenpipeSearchParams): Promise<ScreenpipeResult[]> {
    try {
      const searchParams = new URLSearchParams();

      if (params.q) {
        searchParams.append("q", params.q);
      }
      if (params.content_type && params.content_type !== "all") {
        searchParams.append("content_type", params.content_type);
      }
      // ScreenPipe API accepts limit parameter - examples show 20-50, no documented max
      // We'll allow up to 50 to match their examples, but default to 10 for performance
      searchParams.append(
        "limit",
        String(Math.min(params.limit || 10, 50))
      );
      if (params.start_time) {
        searchParams.append("start_time", params.start_time);
      }
      if (params.end_time) {
        searchParams.append("end_time", params.end_time);
      }
      if (params.app_name) {
        searchParams.append("app_name", params.app_name);
      }
      if (params.window_name) {
        searchParams.append("window_name", params.window_name);
      }

      const response = await fetch(
        `${this.apiUrl}/search?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`ScreenPipe API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      // Return empty array on error - handler will show appropriate message
      return [];
    }
  }
}
