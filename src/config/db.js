// config/db.js
import mongoose from 'mongoose';
import config from './env.js';

export const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    // Mask password in logs for security
    const maskedURI = config.MONGODB_URI.replace(
      /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
      'mongodb$1://$2:********@'
    );
    console.log('📁 Database URI:', maskedURI);

    const conn = await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Enhanced options for better performance
      serverSelectionTimeoutMS: 10000, // Increased to 10s for cloud connections
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🎯 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('💡 Troubleshooting tips:');
    
    if (config.MONGODB_URI.includes('mongodb+srv')) {
      console.log('   For MongoDB Atlas:');
      console.log('   1. Check your Atlas cluster is running');
      console.log('   2. Verify IP whitelist in Atlas Network Access');
      console.log('   3. Confirm database username/password are correct');
      console.log('   4. Ensure database user has correct permissions');
    } else {
      console.log('   For Local MongoDB:');
      console.log('   1. Make sure MongoDB service is running');
      console.log('   2. Check if port 27017 is accessible');
      console.log('   3. Verify the database path exists');
    }
    
    console.log('   5. Check internet connection (for Atlas)');
    console.log('   6. Verify MONGODB_URI in .env file');
    
    process.exit(1);
  }
};

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🗄️  Mongoose connected to database');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from database');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});

export default connectDB;
