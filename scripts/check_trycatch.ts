import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

// Find all app.post, app.get, app.put, app.delete
const routeRegex = /app\.(get|post|put|delete|patch)\(['"`](.*?)['"`],\s*(.*?)=>\s*\{([\s\S]*?)\n\}\);/g;

let match;
while ((match = routeRegex.exec(code)) !== null) {
  const method = match[1];
  const route = match[2];
  const handlerArgs = match[3];
  const body = match[4];
  
  if (handlerArgs.includes('asyncHandler')) continue;
  
  // check if body contains try {
  if (!body.includes('try {')) {
     console.log(`NO TRY/CATCH: ${method.toUpperCase()} ${route}`);
  }
}
