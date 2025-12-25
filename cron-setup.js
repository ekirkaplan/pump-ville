const cron = require('node-cron');
const fetchFn = (...args) =>
  (globalThis.fetch
    ? globalThis.fetch(...args)
    : import('node-fetch').then(({ default: fetch }) => fetch(...args)));

// Her dakika holder'ları yenile (0 * * * * *)
// Test için 30 saniye: */30 * * * * *
// Production için 1 dakika: 0 * * * * *
cron.schedule('0 * * * * *', async () => {
  try {
    console.log('🕐', new Date().toLocaleTimeString(), '- Running holder refresh cron...');
    
    const response = await fetchFn('http://localhost:3000/api/cron/holders');
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Holder refresh completed:', result);
    } else {
      console.error('❌ Holder refresh failed:', result);
    }
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
});

console.log('🚀 Holder refresh cron job started - running every minute');
console.log('📝 Use CTRL+C to stop');

// Keep the process alive
process.stdin.resume();
