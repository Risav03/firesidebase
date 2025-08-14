import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  host: string; // userId
  participants: string[]; // userIds
  startTime: Date;
  endTime: Date | null;
  status: 'upcoming' | 'ongoing' | 'ended';
  roomId: string;
}

const Room: Schema = new Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  description: { type: String, required: true },
  host: { type: String, required: true, ref: 'User' },
  participants: [{ type: String, ref: 'User' }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'ended'], 
    default: 'upcoming' 
  },
  roomId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: false
});

export default mongoose.models.Room || mongoose.model('Room', Room);
