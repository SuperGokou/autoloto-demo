import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DEFAULT_MAX_DIMENSION = 3000;

export async function processImage(
  inputPath: string,
  outputPath: string,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
): Promise<string> {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  let pipeline = image;

  if (Math.max(width, height) > maxDimension) {
    if (width >= height) {
      pipeline = pipeline.resize(maxDimension, undefined, { fit: 'inside' });
    } else {
      pipeline = pipeline.resize(undefined, maxDimension, { fit: 'inside' });
    }
  }

  await pipeline.png({ quality: 90 }).toFile(outputPath);
  return outputPath;
}

export function isPdf(filename: string): boolean {
  return path.extname(filename).toLowerCase() === '.pdf';
}
