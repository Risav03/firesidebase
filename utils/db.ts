import mongoose from 'mongoose';

let isConnected = false;

export const connectToDB = async () => {
  mongoose.set('strictQuery', true);

  if(isConnected) {
    return;
  }

  try {
    const mongoURI = process.env.MONGO_URI;

    if (mongoURI) {
      await mongoose.connect(mongoURI)
      console.log('MongoDB connected successfully!');
      isConnected = true;
    } else {
      console.error('MONGO_URI is not defined in environment variables');
    }
  }
  catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}