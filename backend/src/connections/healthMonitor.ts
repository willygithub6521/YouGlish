/**
 * Connection Health Monitor
 * 
 * Monitors the health of all database connections with:
 * - Periodic health checks
 * - Performance metrics collection
 * - Alert system for connection issues
 * - Automatic recovery attempts
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { PostgreSQLPoolManager, ElasticsearchConnectionManager, RedisConnectionManager } from './poolManager.js';

const logger = createLogger();

export interface HealthStatus {
  service: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  timestamp: Date;
  uptime?: number;
  stats?: any;
}

export interface HealthReport {
  overall: {
    healthy: boolean;
    services: number;
    healthyServices: number;
    unhealthyServices: number;
  };
  services: HealthStatus[];
  timestamp: Date;
}

export interface HealthMonitorConfig {
  checkInterval: number; // milliseconds
  alertThreshold: number; // consecutive failures before alert
  recoveryAttempts: number; // max recovery attempts
  performanceWindow: number; // performance metrics window in milliseconds
}

/**
 * Health Monitor Class
 * Monitors connection health and provides alerting
 */
export class HealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private connections: {
    database?: PostgreSQLPoolManager;
    elasticsearch?: ElasticsearchConnectionManager;
    redis?: RedisConnectionManager;
  } = {};
  
  private healthHistory: Map<string, HealthStatus[]> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private startTime = new Date();

  constructor(config?: Partial<HealthMonitorConfig>) {
    super();
    
    this.config = {
      checkInterval: config?.checkInterval || 30000, // 30 seconds
      alertThreshold: config?.alertThreshold || 3, // 3 consecutive failures
      recoveryAttempts: config?.recoveryAttempts || 3,
      performanceWindow: config?.performanceWindow || 300000, // 5 minutes
      ...config,
    };

    // Initialize failure counts
    this.failureCounts.set('database', 0);
    this.failureCounts.set('elasticsearch', 0);
    this.failureCounts.set('redis', 0);

    // Initialize health history
    this.healthHistory.set('database', []);
    this.healthHistory.set('elasticsearch', []);
    this.healthHistory.set('redis', []);
  }

  /**
   * Register database connections for monitoring
   */
  public registerConnections(connections: {
    database?: PostgreSQLPoolManager;
    elasticsearch?: ElasticsearchConnectionManager;
    redis?: RedisConnectionManager;
  }): void {
    this.connections = connections;
    logger.info('Database connections registered for health monitoring', {
      database: !!connections.database,
      elasticsearch: !!connections.elasticsearch,
      redis: !!connections.redis,
    });
  }

  /**
   * Start health monitoring
   */
  public start(): void {
    if (this.isMonitoring) {
      logger.warn('Health monitor already running');
      return;
    }

    logger.info('Starting health monitor', {
      checkInterval: this.config.checkInterval,
      alertThreshold: this.config.alertThreshold,
    });

    this.isMonitoring = true;
    this.startTime = new Date();

    // Perform initial health check
    this.performHealthCheck();

    // Schedule periodic health checks
    this.monitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping health monitor');

    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const timestamp = new Date();
    const healthStatuses: HealthStatus[] = [];

    // Check PostgreSQL health
    if (this.connections.database) {
      try {
        const health = await this.connections.database.getHealth();
        const status: HealthStatus = {
          service: 'database',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('database', status);
        
        if (health.healthy) {
          this.failureCounts.set('database', 0);
        } else {
          this.handleFailure('database', status);
        }
      } catch (error) {
        const status: HealthStatus = {
          service: 'database',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('database', status);
        this.handleFailure('database', status);
      }
    }

    // Check Elasticsearch health
    if (this.connections.elasticsearch) {
      try {
        const health = await this.connections.elasticsearch.getHealth();
        const status: HealthStatus = {
          service: 'elasticsearch',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('elasticsearch', status);
        
        if (health.healthy) {
          this.failureCounts.set('elasticsearch', 0);
        } else {
          this.handleFailure('elasticsearch', status);
        }
      } catch (error) {
        const status: HealthStatus = {
          service: 'elasticsearch',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('elasticsearch', status);
        this.handleFailure('elasticsearch', status);
      }
    }

    // Check Redis health
    if (this.connections.redis) {
      try {
        const health = await this.connections.redis.getHealth();
        const status: HealthStatus = {
          service: 'redis',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('redis', status);
        
        if (health.healthy) {
          this.failureCounts.set('redis', 0);
        } else {
          this.handleFailure('redis', status);
        }
      } catch (error) {
        const status: HealthStatus = {
          service: 'redis',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        };
        
        healthStatuses.push(status);
        this.updateHealthHistory('redis', status);
        this.handleFailure('redis', status);
      }
    }

    // Generate health report
    const report = this.generateHealthReport(healthStatuses);
    
    // Emit health check event
    this.emit('healthCheck', report);

    // Log health status
    const unhealthyServices = healthStatuses.filter(s => !s.healthy);
    if (unhealthyServices.length > 0) {
      logger.warn('Unhealthy services detected', {
        unhealthyServices: unhealthyServices.map(s => ({
          service: s.service,
          error: s.error,
          latency: s.latency,
        })),
      });
    } else {
      logger.debug('All services healthy', {
        services: healthStatuses.map(s => ({
          service: s.service,
          latency: s.latency,
        })),
      });
    }
  }

  /**
   * Handle service failure
   */
  private handleFailure(service: string, status: HealthStatus): void {
    const currentFailures = this.failureCounts.get(service) || 0;
    const newFailures = currentFailures + 1;
    this.failureCounts.set(service, newFailures);

    logger.error(`Service ${service} health check failed`, {
      failures: newFailures,
      threshold: this.config.alertThreshold,
      error: status.error,
      latency: status.latency,
    });

    // Emit failure event
    this.emit('serviceFailure', {
      service,
      status,
      consecutiveFailures: newFailures,
    });

    // Check if alert threshold is reached
    if (newFailures >= this.config.alertThreshold) {
      logger.error(`Service ${service} alert threshold reached`, {
        consecutiveFailures: newFailures,
        threshold: this.config.alertThreshold,
      });

      this.emit('serviceAlert', {
        service,
        status,
        consecutiveFailures: newFailures,
        threshold: this.config.alertThreshold,
      });

      // Attempt recovery
      this.attemptRecovery(service);
    }
  }

  /**
   * Attempt service recovery
   */
  private async attemptRecovery(service: string): Promise<void> {
    logger.info(`Attempting recovery for service ${service}`);

    try {
      // Recovery logic would go here
      // For now, just emit recovery attempt event
      this.emit('recoveryAttempt', { service });
      
      // Reset failure count on successful recovery
      // This would be set after actual recovery logic
      // this.failureCounts.set(service, 0);
      
    } catch (error) {
      logger.error(`Recovery attempt failed for service ${service}:`, error);
      this.emit('recoveryFailed', { service, error });
    }
  }

  /**
   * Update health history for a service
   */
  private updateHealthHistory(service: string, status: HealthStatus): void {
    const history = this.healthHistory.get(service) || [];
    history.push(status);

    // Keep only recent history within performance window
    const cutoffTime = new Date(Date.now() - this.config.performanceWindow);
    const recentHistory = history.filter(h => h.timestamp > cutoffTime);
    
    this.healthHistory.set(service, recentHistory);
  }

  /**
   * Generate health report
   */
  private generateHealthReport(statuses: HealthStatus[]): HealthReport {
    const healthyServices = statuses.filter(s => s.healthy).length;
    const unhealthyServices = statuses.length - healthyServices;

    return {
      overall: {
        healthy: unhealthyServices === 0,
        services: statuses.length,
        healthyServices,
        unhealthyServices,
      },
      services: statuses,
      timestamp: new Date(),
    };
  }

  /**
   * Get current health status
   */
  public async getCurrentHealth(): Promise<HealthReport> {
    const timestamp = new Date();
    const healthStatuses: HealthStatus[] = [];

    // Get current health for all services
    if (this.connections.database) {
      try {
        const health = await this.connections.database.getHealth();
        healthStatuses.push({
          service: 'database',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        });
      } catch (error) {
        healthStatuses.push({
          service: 'database',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        });
      }
    }

    if (this.connections.elasticsearch) {
      try {
        const health = await this.connections.elasticsearch.getHealth();
        healthStatuses.push({
          service: 'elasticsearch',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        });
      } catch (error) {
        healthStatuses.push({
          service: 'elasticsearch',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        });
      }
    }

    if (this.connections.redis) {
      try {
        const health = await this.connections.redis.getHealth();
        healthStatuses.push({
          service: 'redis',
          healthy: health.healthy,
          latency: health.latency,
          error: health.error,
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
          stats: health.stats,
        });
      } catch (error) {
        healthStatuses.push({
          service: 'redis',
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
          uptime: timestamp.getTime() - this.startTime.getTime(),
        });
      }
    }

    return this.generateHealthReport(healthStatuses);
  }

  /**
   * Get performance metrics for a service
   */
  public getPerformanceMetrics(service: string): {
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    successRate: number;
    totalChecks: number;
  } | null {
    const history = this.healthHistory.get(service);
    if (!history || history.length === 0) {
      return null;
    }

    const latencies = history
      .filter(h => h.latency !== undefined)
      .map(h => h.latency!);
    
    const successfulChecks = history.filter(h => h.healthy).length;

    return {
      averageLatency: latencies.length > 0 
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
        : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      successRate: history.length > 0 ? (successfulChecks / history.length) * 100 : 0,
      totalChecks: history.length,
    };
  }

  /**
   * Get monitoring status
   */
  public getStatus(): {
    isMonitoring: boolean;
    uptime: number;
    checkInterval: number;
    lastCheck?: Date;
  } {
    const lastChecks = Array.from(this.healthHistory.values())
      .flat()
      .map(h => h.timestamp)
      .sort((a, b) => b.getTime() - a.getTime());

    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime.getTime(),
      checkInterval: this.config.checkInterval,
      lastCheck: lastChecks.length > 0 ? lastChecks[0] : undefined,
    };
  }
}