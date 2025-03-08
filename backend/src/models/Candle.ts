// models/Candle.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICandle extends Document {
  pair: string;
  timestamp: number;  // Unix timestamp in UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastUpdated?: Date;
}

const CandleSchema: Schema = new Schema({
  pair: { type: String, required: true, index: true },
  timestamp: { type: Number, required: true, index: true },  // Unix timestamp in UTC
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
  lastUpdated: { 
    type: Date, 
    default: () => new Date(),
    get: (v: Date) => v.toISOString()  // Convert to UTC ISO string when retrieving
  }
}, {
  timestamps: { 
    currentTime: () => new Date()  // MongoDB will store these in UTC
  }
});

// Create a compound index for efficient queries
CandleSchema.index({ pair: 1, timestamp: 1 });

export const CandleModel = mongoose.model<ICandle>('Candle', CandleSchema);