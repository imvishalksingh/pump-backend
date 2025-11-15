// config/db.js
import mongoose from 'mongoose';
import config from './env.js';

export const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log('📁 Database URI:', config.MONGODB_URI);

    const conn = await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('💡 Troubleshooting tips:');
    console.log('   1. Make sure MongoDB is running');
    console.log('   2. Check your MONGODB_URI in .env file');
    console.log('   3. For local MongoDB, use: mongodb://127.0.0.1:27017/fuel-desk');
    process.exit(1);
  }
};

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🗄️  Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected');
});