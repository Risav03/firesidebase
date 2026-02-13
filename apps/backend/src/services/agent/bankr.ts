import { config } from '../../config';

/**
 * Bankr Agent Service
 * 
 * Integrates with Bankr's AI agent API for crypto-focused chat commands.
 * API Documentation: https://docs.bankr.bot/agent-api/overview
 * 
 * Base URL: https://api.bankr.bot
 * Authentication: X-API-Key header
 */

interface BankrPromptResponse {
  success: boolean;
  jobId: string;
  threadId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
}

interface BankrJobResponse {
  success: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  response?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  processingTime?: number;
}

// Bot user constants for Bankr AI messages
export const BANKR_BOT_USER = {
  fid: 'bankr-ai',
  username: 'bankr',
  displayName: 'Bankr AI',
  pfp_url: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/055091fa-db1a-4f35-dee4-1fcd13734500/rectcrop3'
};

// Regex pattern to detect @Bankr or /bankr commands (case-insensitive)
export const BANKR_TRIGGER_PATTERN = /(?:@bankr|\/bankr)\s+(.+)/i;

export class BankrAgentService {
  private static readonly BASE_URL = 'https://api.bankr.bot';
  
  /**
   * Check if the Bankr API is configured
   */
  static isConfigured(): boolean {
    return !!config.bankrApiKey;
  }

  /**
   * Extract prompt from a message that contains @Bankr or /bankr trigger
   */
  static extractPrompt(message: string): string | null {
    const match = message.match(BANKR_TRIGGER_PATTERN);
    return match ? match[1].trim() : null;
  }

  /**
   * Check if a message contains a Bankr trigger
   */
  static hasTrigger(message: string): boolean {
    return BANKR_TRIGGER_PATTERN.test(message);
  }

  /**
   * Submit a prompt to the Bankr AI agent
   */
  static async submitPrompt(prompt: string): Promise<BankrPromptResponse> {
    if (!this.isConfigured()) {
      throw new Error('Bankr API key is not configured');
    }

    const response = await fetch(`${this.BASE_URL}/agent/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.bankrApiKey
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bankr API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get the status of a submitted job
   */
  static async getJobStatus(jobId: string): Promise<BankrJobResponse> {
    if (!this.isConfigured()) {
      throw new Error('Bankr API key is not configured');
    }

    const response = await fetch(`${this.BASE_URL}/agent/job/${jobId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.bankrApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bankr API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Execute a prompt and poll for completion
   * Returns the final response or error
   */
  static async executePromptWithPolling(
    prompt: string,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Submit the prompt
      const submitResult = await this.submitPrompt(prompt);
      
      if (!submitResult.success) {
        return { success: false, error: 'Failed to submit prompt to Bankr AI' };
      }

      const jobId = submitResult.jobId;
      
      // Poll for completion
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await this.sleep(intervalMs);
        
        const jobStatus = await this.getJobStatus(jobId);
        
        switch (jobStatus.status) {
          case 'completed':
            return { 
              success: true, 
              response: jobStatus.response || 'No response received'
            };
          
          case 'failed':
            return { 
              success: false, 
              error: jobStatus.error || 'Bankr AI encountered an error'
            };
          
          case 'cancelled':
            return { 
              success: false, 
              error: 'Request was cancelled'
            };
          
          case 'pending':
          case 'processing':
            // Continue polling
            continue;
        }
      }

      return { 
        success: false, 
        error: 'Request timed out. Please try again.'
      };
      
    } catch (error) {
      console.error('Bankr AI error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Helper function for polling delay
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
