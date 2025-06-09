import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000', // React local dev server
  'https://fantastic-space-fishstick-4wrgwqv4vp37749-3000.app.github.dev/', // Codespaces frontend preview URL
];

app.use(cors({
  origin: '*'
}));



// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is up and running!' });
});

// CrUX API route
app.post('/api/crux', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const cruxData = await getCruxData(url);
    res.json(cruxData);
  } catch (error) {
    console.error('CrUX API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch CrUX data' });
  }
});

// Utility function
async function getCruxData(url) {
  const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${process.env.GOOGLE_API_KEY}`;

  const payload = {
    formFactor: 'PHONE',
    origin: url
  };

  const response = await axios.post(endpoint, payload);
  return response.data;
}

// Start server on 0.0.0.0 for GitHub Codespaces compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
