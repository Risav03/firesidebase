import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    
    // Check if we can access the database
    const collections = await mongoose?.connection?.db?.listCollections().toArray();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful',
      collections: collections?.map((col: any) => col.name),
      connectionState: mongoose.connection.readyState
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
