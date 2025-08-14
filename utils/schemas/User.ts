import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  fid: string;
  username: string;
  displayName: string;
  pfp_url: string;
  bio?: string;
}

const User: Schema = new Schema({
  fid: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  pfp_url: { type: String, required: true },
  bio: { type: String, required: false },
});

export default mongoose.models.User || mongoose.model('User', User);