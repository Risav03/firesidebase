import mongoose, { Schema } from 'mongoose';
import User from './User';
import type { Room, RoomStatus } from '../schemas';

const Room: Schema = new Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  adsEnabled: { type: Boolean, default: true },
  description: { type: String, required: false },
  host: { type: mongoose.Schema.Types.ObjectId, required: true, ref: User },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  ended_at: { type: Date, default: null }, // When the room was ended by host
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'ended'], 
    default: 'upcoming' 
  },
  roomId: { type: String, default: "" }, // HMS Room ID
  interested: [{ type: mongoose.Schema.Types.ObjectId, default: [] }], // Array of user FIDs who showed interest
  participants: [{ type: mongoose.Schema.Types.ObjectId, default: [] }], // Array of user FIDs who participated
  topics: [{ type: String, default: [] }],
}, {
  timestamps: true
});

export default (mongoose.models.Room as any) || mongoose.model('Room', Room as any);
