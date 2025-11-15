// config/env.js
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Export environment variables
const config = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate required environment variables
const required = ['MONGODB_URI', 'JWT_SECRET'];
required.forEach(key => {
  if (!config[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    console.log('💡 Please check your .env file in the backend root directory');
    process.exit(1);
  }
});

console.log('✅ Environment variables loaded successfully');
console.log('🌍 Environment:', config.NODE_ENV);
console.log('🚀 Server port:', config.PORT);
console.log('📧 Email configured:', !!(config.EMAIL_USER && config.EMAIL_PASS));
console.log('🔗 Frontend URL:', config.FRONTEND_URL);
console.log('🗄️  MongoDB URI:', config.MONGODB_URI ? '✓ Set' : '✗ Missing');

export default config;