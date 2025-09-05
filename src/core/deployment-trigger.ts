/**
 * Deployment trigger module for Dokploy and other platforms
 */

import axios, { AxiosError } from 'axios';
import type {
  DeploymentTrigger,
  DeploymentInfo,
  RuntimeContext,
  DeploymentStatus
} from '../types/index.js';
import { BuildError } from '../types/index.js';

export interface WebhookPayload {
  ref?: string;
  branch?: string;
  trigger?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface DeploymentStatusResponse {
  status: string;
  url?: string;
  error?: string;
  [key: string]: any;
}

export class DokployDeploymentTrigger implements DeploymentTrigger {
  private readonly timeout: number = 30000; // 30 seconds

  /**
   * Trigger deployment via webhook
   */
  async trigger(context: RuntimeContext): Promise<DeploymentInfo> {
    const deploymentConfig = context.config.deployment;

    if (!deploymentConfig?.webhook) {
      throw new BuildError('Deployment webhook URL not configured');
    }

    const startTime = Date.now();

    try {
      const payload: WebhookPayload = {
        ref: context.revision,
        branch: context.branch,
        trigger: 'ccanywhere',
        timestamp: context.timestamp
      };

      const response = await axios.post(deploymentConfig.webhook, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CCanywhere/0.1.0'
        },
        timeout: this.timeout
      });

      // Handle successful response
      if (response.status >= 200 && response.status < 300) {
        const deploymentInfo: DeploymentInfo = {
          status: 'running',
          startTime,
          url: undefined
        };

        // If status URL is configured, wait for deployment completion
        if (deploymentConfig.statusUrl) {
          return await this.waitForCompletion(deploymentInfo, deploymentConfig, context);
        }

        return deploymentInfo;
      } else {
        throw new BuildError(
          `Deployment webhook returned ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      const endTime = Date.now();

      if (error instanceof AxiosError) {
        return {
          status: 'failed',
          startTime,
          endTime,
          error: `HTTP ${error.response?.status}: ${error.response?.statusText || error.message}`
        };
      }

      return {
        status: 'failed',
        startTime,
        endTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get deployment status
   */
  async getStatus(_deploymentId: string): Promise<DeploymentInfo> {
    // This implementation depends on the deployment platform's API
    // For now, return a basic implementation
    return {
      status: 'running',
      startTime: Date.now()
    };
  }

  /**
   * Wait for deployment completion
   */
  private async waitForCompletion(
    initialInfo: DeploymentInfo,
    deploymentConfig: NonNullable<RuntimeContext['config']['deployment']>,
    _context: RuntimeContext
  ): Promise<DeploymentInfo> {
    const maxWait = (deploymentConfig.maxWait || 300) * 1000; // Convert to milliseconds
    const pollInterval = (deploymentConfig.pollInterval || 5) * 1000; // Convert to milliseconds
    const startTime = Date.now();

    const deploymentInfo = { ...initialInfo };

    while (Date.now() - startTime < maxWait) {
      try {
        const statusResponse = await axios.get(deploymentConfig.statusUrl!, {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'CCanywhere/0.1.0'
          }
        });

        const statusData: DeploymentStatusResponse = statusResponse.data;
        const status = this.normalizeStatus(statusData.status);

        deploymentInfo.status = status;

        if (statusData.url) {
          deploymentInfo.url = statusData.url;
        }

        if (statusData.error) {
          deploymentInfo.error = statusData.error;
        }

        // Check if deployment is complete
        if (status === 'success' || status === 'failed' || status === 'cancelled') {
          deploymentInfo.endTime = Date.now();
          return deploymentInfo;
        }

        // Wait before next poll
        await this.sleep(pollInterval);
      } catch (error) {
        // If status check fails, continue polling for a bit longer
        console.warn(
          `Status check failed: ${error instanceof Error ? error.message : String(error)}`
        );
        await this.sleep(pollInterval);
      }
    }

    // Timeout reached
    deploymentInfo.status = 'running'; // Still running, but we stopped waiting
    deploymentInfo.error = `Deployment status check timed out after ${maxWait / 1000}s`;

    return deploymentInfo;
  }

  /**
   * Normalize deployment status from different platforms
   */
  private normalizeStatus(status: string): DeploymentStatus {
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case 'success':
      case 'completed':
      case 'deployed':
      case 'ready':
        return 'success';
      case 'failed':
      case 'error':
      case 'failure':
        return 'failed';
      case 'cancelled':
      case 'canceled':
      case 'aborted':
        return 'cancelled';
      case 'running':
      case 'deploying':
      case 'building':
      case 'in_progress':
        return 'running';
      case 'pending':
      case 'queued':
      case 'waiting':
        return 'pending';
      default:
        return 'running';
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Generic webhook deployment trigger
 */
export class GenericWebhookDeploymentTrigger implements DeploymentTrigger {
  private readonly customHeaders?: Record<string, string>;

  constructor(customHeaders?: Record<string, string>) {
    this.customHeaders = customHeaders;
  }

  async trigger(context: RuntimeContext): Promise<DeploymentInfo> {
    const deploymentConfig = context.config.deployment;

    if (!deploymentConfig?.webhook) {
      throw new BuildError('Deployment webhook URL not configured');
    }

    const startTime = Date.now();

    try {
      const payload: WebhookPayload = {
        repository: context.config.repo?.url,
        ref: context.revision,
        branch: context.branch,
        timestamp: context.timestamp,
        triggered_by: 'ccanywhere'
      };

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'CCanywhere/0.1.0',
        ...this.customHeaders
      };

      const response = await axios.post(deploymentConfig.webhook, payload, {
        headers,
        timeout: 30000
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          status: 'success',
          startTime,
          endTime: Date.now(),
          url: undefined
        };
      } else {
        throw new BuildError(`Webhook returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const endTime = Date.now();

      if (error instanceof AxiosError) {
        return {
          status: 'failed',
          startTime,
          endTime,
          error: `HTTP ${error.response?.status}: ${error.response?.statusText || error.message}`
        };
      }

      return {
        status: 'failed',
        startTime,
        endTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getStatus(_deploymentId: string): Promise<DeploymentInfo> {
    return {
      status: 'running',
      startTime: Date.now()
    };
  }
}

/**
 * Factory function to create deployment triggers
 */
export function createDeploymentTrigger(
  type: 'dokploy' | 'generic' = 'dokploy',
  options?: { customHeaders?: Record<string, string> }
): DeploymentTrigger {
  switch (type) {
    case 'dokploy':
      return new DokployDeploymentTrigger();
    case 'generic':
      return new GenericWebhookDeploymentTrigger(options?.customHeaders);
    default:
      throw new Error(`Unknown deployment trigger type: ${type}`);
  }
}
