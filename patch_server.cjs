const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes("import cron from 'node-cron'")) {
  content = "import cron from 'node-cron';\nimport { backupAllDatabases } from './server/backup.js';\n" + content;
  
  // Find startServer
  const startServerIdx = content.indexOf('async function startServer() {');
  if (startServerIdx !== -1) {
    const backupCode = `
  // Schedule database backup every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled database backup...');
    await backupAllDatabases();
  });
`;
    content = content.replace('async function startServer() {', 'async function startServer() {' + backupCode);
  }
  
  fs.writeFileSync('server.ts', content);
  console.log('server.ts patched');
} else {
  console.log('cron already patched');
}
