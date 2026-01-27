import app from './app';
import { warmUpCache } from './controllers/novelController';

// Start the server (Warmup + Chapter Cache Enabled)
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Trigger Cache Warmup
  await warmUpCache();
});