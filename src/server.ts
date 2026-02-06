import app from './app';

// Start the server (Warmup + Chapter Cache Enabled)
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Force Redis connection check (optional, logging is in redis.ts)
  import('./utils/redis'); 
});