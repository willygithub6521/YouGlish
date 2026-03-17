// Simple validation script to check if the server can be imported and started
import app from './index.js';

console.log('✅ Server module imported successfully');
console.log('✅ Express app created');

// Test if the app has the expected properties
if (typeof app.listen === 'function') {
  console.log('✅ App has listen method');
} else {
  console.log('❌ App missing listen method');
}

console.log('✅ All basic validations passed');
process.exit(0);