/**
 * Validation script for connection layers
 * 
 * This script validates that all connection layer modules can be imported
 * and basic functionality works as expected.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger();

async function validateConnections() {
  logger.info('🔍 Validating connection layers...');

  try {
    // Test imports
    logger.info('📦 Testing module imports...');
    
    const { ConnectionManager } = await import('./index.js');
    const { ConnectionFactory } = await import('./factory.js');
    const { HealthMonitor } = await import('./healthMonitor.js');
    const { PostgreSQLPoolManager, ElasticsearchConnectionManager, RedisConnectionManager } = await import('./poolManager.js');
    
    logger.info('✅ All modules imported successfully');

    // Test singleton patterns
    logger.info('🔄 Testing singleton patterns...');
    
    const manager1 = ConnectionManager.getInstance();
    const manager2 = ConnectionManager.getInstance();
    
    if (manager1 === manager2) {
      logger.info('✅ ConnectionManager singleton working correctly');
    } else {
      throw new Error('ConnectionManager singleton not working');
    }

    const factory1 = ConnectionFactory.getInstance();
    const factory2 = ConnectionFactory.getInstance();
    
    if (factory1 === factory2) {
      logger.info('✅ ConnectionFactory singleton working correctly');
    } else {
      throw new Error('ConnectionFactory singleton not working');
    }

    // Test configuration validation
    logger.info('⚙️ Testing configuration validation...');
    
    const validConfig = {
      database: {
        host: 'localhost',
        port: 5432,
        min: 2,
        max: 10,
      },
      elasticsearch: {
        url: 'http://localhost:9200',
        maxRetries: 3,
      },
      redis: {
        port: 6379,
        db: 0,
      },
    };

    const validation = factory1.validateConfiguration(validConfig);
    if (validation.valid) {
      logger.info('✅ Configuration validation working correctly');
    } else {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Test health monitor creation
    logger.info('🏥 Testing health monitor creation...');
    
    const healthMonitor = new HealthMonitor({
      checkInterval: 60000,
      alertThreshold: 3,
    });
    
    const status = healthMonitor.getStatus();
    if (typeof status.isMonitoring === 'boolean') {
      logger.info('✅ HealthMonitor creation working correctly');
    } else {
      throw new Error('HealthMonitor creation failed');
    }

    logger.info('🎉 All connection layer validations passed!');
    return true;

  } catch (error) {
    logger.error('❌ Connection layer validation failed:', error);
    return false;
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateConnections()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Validation script error:', error);
      process.exit(1);
    });
}

export { validateConnections };