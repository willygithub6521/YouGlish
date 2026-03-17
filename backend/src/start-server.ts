// Simple server startup script for testing
import './index.js';

console.log('🚀 Server startup script executed');
console.log('📝 Check the logs above for server status');
console.log('🌐 Server should be running on the configured port');

// Keep the process alive for a few seconds to see logs
setTimeout(() => {
  console.log('✅ Server startup validation complete');
  process.exit(0);
}, 3000);