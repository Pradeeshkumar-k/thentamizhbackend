// import fetch from "node-fetch"; // Node 18+ has native fetch


// Replace with your actual deployed backend URL
const BACKEND_URL = "https://thentamizhbackend.vercel.app/api/health";

console.log(`[Keep-Alive] Starting ping service for ${BACKEND_URL}`);

const ping = async () => {
  try {
    const res = await fetch(BACKEND_URL);
    if (res.ok) {
        console.log(`[Keep-Alive] Ping success at ${new Date().toISOString()}`);
    } else {
        console.error(`[Keep-Alive] Ping failed: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error(`[Keep-Alive] Ping error:`, error);
  }
};

// Initial ping
ping();

// Ping every 5 minutes (5 * 60 * 1000)
setInterval(ping, 300000);
