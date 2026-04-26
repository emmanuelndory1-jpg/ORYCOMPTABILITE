import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// Also support catch (error)
code = code.replace(/res\.status\(500\)\.json\([^{]*\{\s*error:\s*([^}]+)\s*\}\);?/g, (match, errContent) => {
  if (errContent.includes('error.message')) {
     return 'handleApiError(res, error);';
  } else if (errContent.includes('err.message')) {
     return 'handleApiError(res, err);';
  } else {
     // For string literals, we can throw an error to handleApiError or just pass an error object
     return `handleApiError(res, new AppError(${errContent}, 500, "server_error"));`;
  }
});

fs.writeFileSync('server.ts', code, 'utf8');
console.log('Additional refactoring applied.');
