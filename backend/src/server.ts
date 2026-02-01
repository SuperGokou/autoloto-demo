import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { analyzeDiagram } from './services/inference';
import { processImage, isPdf } from './services/preprocess';
import { getLockoutRequirements } from './services/loto';
import { autoLayout } from './utils/layout';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// File upload
app.post('/api/upload', upload.single('file'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (ext === '.pdf') {
    // For PDF files, we'd need pdf2pic or similar. For now, return error suggesting image upload.
    return res.status(400).json({
      error: 'PDF upload requires poppler. Please convert to PNG/JPG first, or install poppler.',
    });
  }

  // Process image (resize if needed)
  const processedPath = path.join(uploadsDir, `processed_${req.file.filename}.png`);
  try {
    await processImage(filePath, processedPath);
    res.json({ imagePath: processedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze circuit diagram
app.post('/api/analyze', async (req: any, res: any) => {
  const { imagePath, model, referencePath } = req.body;

  if (!imagePath) {
    return res.status(400).json({ error: 'imagePath is required' });
  }

  if (!fs.existsSync(imagePath)) {
    return res.status(400).json({ error: 'Image file not found' });
  }

  try {
    const topology = await analyzeDiagram(imagePath, model || 'qwen3-vl:latest', referencePath);

    // If first attempt with reference fails, retry without
    if (topology.parse_error && referencePath) {
      const retry = await analyzeDiagram(imagePath, model || 'qwen3-vl:latest');
      if (!retry.parse_error) {
        return res.json(retry);
      }
    }

    res.json(topology);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate LOTO steps
app.post('/api/loto', (req: any, res: any) => {
  const { topology, componentId } = req.body;

  if (!topology || !componentId) {
    return res.status(400).json({ error: 'topology and componentId are required' });
  }

  const requirements = getLockoutRequirements(topology, componentId);
  res.json(requirements);
});

// Auto-layout endpoint
app.post('/api/layout', (req: any, res: any) => {
  const { topology } = req.body;
  if (!topology) {
    return res.status(400).json({ error: 'topology is required' });
  }
  const nodes = autoLayout(topology);
  res.json(nodes);
});

app.listen(PORT, () => {
  console.log(`AutoLOTO backend running on http://localhost:${PORT}`);
});
