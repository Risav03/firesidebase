import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  fid: string;
}

const User: Schema = new Schema({
  fid: { type: String, required: true, unique: true }
});

export default mongoose.models.User || mongoose.model('User', User);