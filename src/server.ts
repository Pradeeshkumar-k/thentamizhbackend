import app from './app';
import redis from './utils/redis';

// Start the server (Warmup + Chapter Cache Enabled)
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  redis.ping().then(res => {
    console.log("[REDIS PING]", res);
  }).catch(err => {
    console.error('[REDIS ERROR]', err);
  });
});