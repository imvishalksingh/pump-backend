// config/db.js
import mongoose from 'mongoose';
import config from './env.js';

export const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    console.log('📁 Database URI:', config.MONGODB_URI.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://username:********@'));

    const conn = await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Add these options for better Atlas compatibility
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🎯 Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection error:', error.message);
    console.log('💡 MongoDB Atlas Troubleshooting tips:');
    console.log('   1. Check your MONGODB_URI in .env file');
    console.log('   2. Verify your Atlas cluster is running and accessible');
    console.log('   3. Check if your IP is whitelisted in Atlas Network Access');
    console.log('   4. Verify database username/password are correct');
    console.log('   5. Ensure the database user has correct permissions');
    console.log('   6. Check internet connection and firewall settings');
    process.exit(1);
  }
};

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🗄️  Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB Atlas');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});
