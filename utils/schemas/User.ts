import mongoose, { Schema, Document, Mongoose } from 'mongoose';

export interface IUser extends Document {
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
  wallet:string;
  bio?: string;
  hostedRooms: mongoose.Types.ObjectId[]; // Array of Room ObjectIds
  topics: string[];
}

const User: Schema = new Schema({
  fid: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  wallet: { type: String, required: true },
  pfp_url: { type: String, required: true },
  bio: { type: String, required: false },
  hostedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  topics: [{ type: String, required: false, default: [] }],
});

export default mongoose.models.User || mongoose.model('User', User);