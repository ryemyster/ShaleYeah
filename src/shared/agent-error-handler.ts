/**
 * Unified Agent Error Handler
 * DRY principle: Consolidates error handling patterns across all agents
 */

export interface AgentError {
  code: string;
  message: string;
  context?: any;
  timestamp: number;
  agentName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelay: number;
  escalationThreshold: 'low' | 'medium' | 'high';
  logStackTrace: boolean;
}

export class AgentErrorHandler {
  private static defaultConfig: ErrorHandlingConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    escalationThreshold: 'high',
    logStackTrace: true
  };

  constructor(
    private agentName: string,
    private logger: Console,
    private config: Partial<ErrorHandlingConfig> = {}
  ) {}

  /**
   * Standardized error logging with severity classification
   */
  logError(error: any, context?: any): AgentError {
    const agentError: AgentError = {
      code: this.classifyErrorCode(error),
      message: String(error),
      context,
      timestamp: Date.now(),
      agentName: this.agentName,
      severity: this.classifyErrorSeverity(error)
    };

    const config = { ...AgentErrorHandler.defaultConfig, ...this.config };
    
    switch (agentError.severity) {
      case 'critical':
        this.logger.error(`🚨 CRITICAL [${this.agentName}]: ${agentError.message}`, context);
        break;
      case 'high':
        this.logger.error(`❌ HIGH [${this.agentName}]: ${agentError.message}`, context);
        break;
      case 'medium':
        this.logger.warn(`⚠️  MEDIUM [${this.agentName}]: ${agentError.message}`, context);
        break;
      case 'low':
        this.logger.info(`ℹ️  LOW [${this.agentName}]: ${agentError.message}`, context);
        break;
    }

    if (config.logStackTrace && error.stack) {
      this.logger.debug(`Stack trace [${this.agentName}]:`, error.stack);
    }

    return agentError;
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customRetries?: number
  ): Promise<T> {
    const config = { ...AgentErrorHandler.defaultConfig, ...this.config };
    const maxRetries = customRetries ?? config.maxRetries;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = config.retryDelay * Math.pow(2, attempt - 2); // Exponential backoff
          this.logger.info(`🔄 [${this.agentName}] Retry ${attempt}/${maxRetries} for ${operationName} in ${delay}ms`);
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error;
        const agentError = this.logError(error, { attempt, operationName });
        
        if (attempt === maxRetries) {
          this.logger.error(`💥 [${this.agentName}] All retries exhausted for ${operationName}`);
          break;
        }
        
        if (agentError.severity === 'critical') {
          this.logger.error(`🛑 [${this.agentName}] Critical error - aborting retries`);
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if error should escalate to human
   */
  shouldEscalate(error: AgentError): boolean {
    const config = { ...AgentErrorHandler.defaultConfig, ...this.config };
    
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const errorLevel = severityLevels.indexOf(error.severity);
    const thresholdLevel = severityLevels.indexOf(config.escalationThreshold);
    
    return errorLevel >= thresholdLevel;
  }

  /**
   * Create standardized error report for escalation
   */
  createEscalationReport(errors: AgentError[]): any {
    return {
      agentName: this.agentName,
      escalationTimestamp: Date.now(),
      errorCount: errors.length,
      criticalErrors: errors.filter(e => e.severity === 'critical').length,
      highErrors: errors.filter(e => e.severity === 'high').length,
      errors: errors.map(e => ({
        code: e.code,
        message: e.message,
        severity: e.severity,
        timestamp: e.timestamp
      })),
      recommendation: this.generateRecommendation(errors)
    };
  }

  private classifyErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.name) return error.name;
    if (error.message?.includes('timeout')) return 'TIMEOUT';
    if (error.message?.includes('network')) return 'NETWORK_ERROR';
    if (error.message?.includes('permission')) return 'PERMISSION_DENIED';
    if (error.message?.includes('not found')) return 'NOT_FOUND';
    return 'UNKNOWN_ERROR';
  }

  private classifyErrorSeverity(error: any): AgentError['severity'] {
    const message = String(error).toLowerCase();
    
    // Critical errors that require immediate attention
    if (message.includes('security') || 
        message.includes('authentication') ||
        message.includes('corruption') ||
        error.code === 'EACCES') {
      return 'critical';
    }
    
    // High severity errors that affect functionality
    if (message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('failed to') ||
        error.code === 'ENOENT') {
      return 'high';
    }
    
    // Medium severity warnings
    if (message.includes('warning') ||
        message.includes('deprecated') ||
        message.includes('missing optional')) {
      return 'medium';
    }
    
    // Low severity informational
    return 'low';
  }

  private generateRecommendation(errors: AgentError[]): string {
    const criticalCount = errors.filter(e => e.severity === 'critical').length;
    const highCount = errors.filter(e => e.severity === 'high').length;
    
    if (criticalCount > 0) {
      return `Critical errors detected. Immediate human intervention required. Check security and authentication.`;
    }
    
    if (highCount > 2) {
      return `Multiple high-severity errors. Review system configuration and network connectivity.`;
    }
    
    if (errors.length > 5) {
      return `High error frequency detected. Consider adjusting agent configuration or input data quality.`;
    }
    
    return `Monitor errors and consider retry with different parameters.`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}