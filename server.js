import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isEditor = process.argv.includes('--editor');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'text/plain'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle image uploads
  if (req.method === 'POST' && req.url.startsWith('/upload')) {
    if (!isEditor) {
      res.writeHead(403);
      res.end('Not in editor mode');
      return;
    }
    const urlObj = new URL(req.url, "http://" + req.headers.host);
    const filename = urlObj.searchParams.get('filename');
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const writeStream = fs.createWriteStream(path.join(__dirname, 'photos', safeFilename));
    req.pipe(writeStream);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: 'photos/' + safeFilename }));
    });
    return;
  }


  // Handle save request
  if (req.method === 'POST' && req.url === '/save') {
    if (!isEditor) {
      res.writeHead(403);
      res.end('Not in editor mode');
      return;
    }
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const dataPath = path.join(__dirname, 'data.json');
        fs.writeFileSync(dataPath, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Error saving:', err);
        res.writeHead(500);
        res.end('Error saving data');
      }
    });
    return;
  }

  // Handle get editor state
  if (req.method === 'GET' && req.url === '/mode') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isEditor }));
    return;
  }

  // Handle /api/config proxy or default
  if (req.method === 'GET' && req.url === '/api/config') {
      try {
        const dataPath = path.join(__dirname, 'data.json');
        if(fs.existsSync(dataPath)) {
           const content = fs.readFileSync(dataPath, 'utf-8');
           res.writeHead(200, { 'Content-Type': 'application/json' });
           res.end(content);
        } else {
           res.writeHead(404);
           res.end('{}');
        }
      } catch(err) {
           res.writeHead(500);
           res.end('{}');
      }
      return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query string if any
  filePath = filePath.split('?')[0];
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  const absolutePath = path.join(__dirname, filePath);
  
  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      if(error.code === 'ENOENT') {
        // SPA routing - always serve index.html for unknown routes
        if (!extname || extname === '.html') {
          fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
            if (err) {
              res.writeHead(500);
              res.end('Error loading index.html');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        } else {
          res.writeHead(404);
          res.end('File not found');
        }
      } else {
        res.writeHead(500);
        res.end('Internal server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('=================================');
  console.log(`Servidor iniciado (${isEditor ? 'MODO EDICIÓN' : 'MODO VISOR'})`);
  console.log(`Abre tu navegador en: http://localhost:${PORT}`);
  console.log('=================================');
  
  exec(`start http://localhost:${PORT}`);
});
