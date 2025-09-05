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


export class SimpleDeploymentTrigger implements DeploymentTrigger {
  private readonly timeout: number = 30000; // 30 seconds

  /**
   * Trigger deployment via webhook
   */
  async trigger(context: RuntimeContext): Promise<DeploymentInfo> {
    const deploymentConfig = context.config.deployment;
    
    // Extract webhook URL - support both string and object format
    const webhookUrl = typeof deploymentConfig === 'string' 
      ? deploymentConfig 
      : deploymentConfig?.webhook;

    if (!webhookUrl) {
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

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CCanywhere/0.1.0'
        },
        timeout: this.timeout
      });

      // Handle successful response
      if (response.status >= 200 && response.status < 300) {
        return {
          status: 'success',
          startTime,
          endTime: Date.now(),
          url: undefined
        };
      } else {
        return {
          status: 'failed',
          startTime,
          endTime: Date.now(),
          error: `Deployment webhook returned ${response.status}: ${response.statusText}`
        };
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
   * Get deployment status - simplified implementation
   */
  async getStatus(_deploymentId: string): Promise<DeploymentInfo> {
    // Simplified: just return success since we don't track status anymore
    return {
      status: 'success',
      startTime: Date.now(),
      endTime: Date.now()
    };
  }
}


/**
 * Factory function to create deployment trigger
 */
export function createDeploymentTrigger(
  _type?: string,
  _options?: { customHeaders?: Record<string, string> }
): DeploymentTrigger {
  return new SimpleDeploymentTrigger();
}

/**
 * Helper function to check if deployment is configured
 */
export function hasDeploymentConfig(config: { deployment?: string | { webhook: string } }): boolean {
  if (!config.deployment) {
    return false;
  }
  
  if (typeof config.deployment === 'string') {
    return config.deployment.trim().length > 0;
  }
  
  return !!(config.deployment.webhook && config.deployment.webhook.trim().length > 0);
}
