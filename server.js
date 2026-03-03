const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IncomingForm } = require('formidable');

const PORT = 5000;
const ROOT = __dirname;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const activeSessions = new Map();
const SESSION_TTL = 4 * 60 * 60 * 1000;

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidSession(token) {
  const expiry = activeSessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.webp': 'image/webp',
};

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];

  if (urlPath === '/') {
    urlPath = '/index.html';
  } else if (urlPath === '/admin' || urlPath === '/admin/') {
    urlPath = '/admin/index.html';
  } else if (!path.extname(urlPath)) {
    urlPath = urlPath + '.html';
  }

  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkAuth(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return isValidSession(authHeader.slice(7));
  }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    return isValidSession(tokenParam);
  }
  return false;
}

function generatePostHtml(data) {
  const { dayNumber, date, week, title, summary, painLevel, swelling, imageName, journalEntry, keyTakeaways, prevLink, prevLabel, nextLink, nextLabel } = data;

  const MONTH_MAP = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  let isoDate = '';
  const dateMatch = date.match(/^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (dateMatch && MONTH_MAP[dateMatch[1]]) {
    isoDate = `${dateMatch[3]}-${MONTH_MAP[dateMatch[1]]}-${dateMatch[2].padStart(2, '0')}`;
  } else {
    const dateObj = new Date(date);
    isoDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
  }

  const slug = `day-${dayNumber}`;
  const fileName = `${slug}.html`;
  const canonicalUrl = `https://www.kneecomeback.com/posts/${fileName}`;
  const imageUrl = `https://www.kneecomeback.com/images/${imageName}`;
  const shortDesc = summary.length > 160 ? summary.substring(0, 157) + '...' : summary;

  const paragraphs = journalEntry
    .split('\n')
    .filter(p => p.trim())
    .map(p => `        <p>\n            ${p.trim()}\n        </p>`)
    .join('\n\n');

  const takeawayItems = keyTakeaways
    .split('\n')
    .filter(t => t.trim())
    .map(t => `            <li>${t.trim()}</li>`)
    .join('\n');

  let prevNav = '';
  if (prevLink) {
    prevNav = `
                <a href="${prevLink}" class="group p-4 border border-gray-200 rounded-xl hover:border-google-blue transition-colors duration-200">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Previous Entry</span>
                    <div class="flex items-center mt-1 text-gray-900 font-bold group-hover:text-google-blue">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        ${prevLabel}
                    </div>
                </a>`;
  } else {
    prevNav = `<div></div>`;
  }

  let nextNav = '';
  if (nextLink) {
    nextNav = `
                <a href="${nextLink}" class="group p-4 border border-gray-200 rounded-xl text-right hover:border-google-blue transition-colors duration-200">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Entry</span>
                    <div class="flex items-center justify-end mt-1 text-gray-900 font-bold group-hover:text-google-blue">
                        ${nextLabel}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </a>`;
  } else {
    nextNav = `<div></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head> 
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HSMXV4NWY9"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-HSMXV4NWY9');
</script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>${title} | KneeComeback</title>
    <meta name="description" content="${shortDesc}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta name="robots" content="index,follow,max-image-preview:large">

    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${shortDesc}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:alt" content="Day ${dayNumber} recovery timeline photo">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${shortDesc}">
    <meta name="twitter:image" content="${imageUrl}">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/style.css">
    <style>
        .google-blue { color: #4285F4; }
        .bg-google-blue { background-color: #4285F4; }
    </style>
</head>
<body class="bg-white text-gray-800 antialiased">

<nav class="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
    <div class="max-w-5xl mx-auto px-5 py-4 flex justify-between items-center">
        <a href="../index.html" class="text-xl font-bold tracking-tight text-gray-900">
            Knee<span class="google-blue">Comeback</span>
        </a>

        <div class="flex items-center">
            <div class="hidden md:flex space-x-8 text-sm font-semibold text-gray-500 mr-8">
                <a href="../index.html" class="hover:text-blue-600 transition-colors">Timeline</a>
                <a href="../exercises.html" class="hover:text-blue-600 transition-colors">Exercises</a>
                <a href="../tips.html" class="hover:text-blue-600 transition-colors">Tips</a>
                <a href="../about.html" class="hover:text-blue-600 transition-colors">About</a>
            </div>

            <div class="flex items-center space-x-4 border-l pl-4 border-gray-200">
                <button id="menu-btn" class="md:hidden text-gray-500 focus:outline-none" aria-label="Toggle menu">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <div id="mobile-menu" class="hidden md:hidden bg-white border-t border-gray-100 px-5 py-6 space-y-4 shadow-xl">
        <a href="../index.html" class="block text-lg font-medium text-gray-600 hover:text-blue-600">Timeline</a>
        <a href="../exercises.html" class="block text-lg font-medium text-gray-600 hover:text-blue-600">Exercises</a>
        <a href="../tips.html" class="block text-lg font-medium text-gray-600 hover:text-blue-600">Tips</a>
        <a href="../about.html" class="block text-lg font-medium text-gray-600 hover:text-blue-600">About</a>
    </div>
</nav>

<main class="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">

    <div class="mb-8">
        <a href="../index.html#timeline" class="text-sm font-medium text-google-blue hover:underline flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Timeline
        </a>
    </div>

    <header class="mb-12">
        <div class="flex flex-wrap items-center gap-y-2 text-sm text-gray-500 font-medium mb-4">
            <span class="bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full mr-3">${week}</span>
            <time datetime="${isoDate}">${date}</time>
        </div>

        <h1 class="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
            ${title}
        </h1>

        <p class="text-xl text-gray-500 leading-relaxed italic">
            "${summary}"
        </p>

        <div class="mt-8 flex flex-wrap gap-4 border-y border-gray-100 py-6">
            <div class="flex flex-col">
                <span class="text-xs uppercase tracking-wider text-gray-400 font-bold">Pain Level</span>
                <span class="text-2xl font-bold text-gray-900">${painLevel}/10</span>
            </div>
            <div class="w-px h-10 bg-gray-200 mx-2"></div>
            <div class="flex flex-col">
                <span class="text-xs uppercase tracking-wider text-gray-400 font-bold">Swelling</span>
                <span class="text-2xl font-bold text-gray-900">${swelling}/10</span>
            </div>
        </div>
    </header>

    <div class="mb-12 rounded-2xl overflow-hidden shadow-lg">
        <img src="../images/${imageName}" alt="Progress Photo Day ${dayNumber}" class="w-full h-auto object-cover">
    </div>

    <article class="prose prose-blue prose-lg max-w-none text-gray-600 leading-relaxed space-y-6">
${paragraphs}

        <h3 class="text-2xl font-bold text-gray-900 mt-10 mb-4">Key Takeaways</h3>
        <ul class="list-disc list-inside space-y-2 text-gray-700">
${takeawayItems}
        </ul>
    </article>

    <nav class="mt-20 border-t border-gray-200 pt-10">
        <div class="grid grid-cols-2 gap-4">
${prevNav}
${nextNav}
        </div>
    </nav>

</main>

<footer class="bg-white border-t border-gray-200 py-12 text-center">
    <div class="max-w-4xl mx-auto px-5">
        <div class="flex flex-col items-center space-y-4">
            <a href="mailto:dczarcin@gmail.com" class="text-sm font-semibold text-gray-500 hover:text-google-blue transition-colors flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Contact Me
            </a>

            <p class="text-base text-gray-400">My Personal Recovery Journey. Not medical advice.</p>

            <a href="#" class="text-xs font-bold uppercase text-gray-300 hover:text-gray-600 transition-colors tracking-widest">
                Back to top &uarr;
            </a>
        </div>
    </div>
</footer>

<script>
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
</script>

</body>
</html>`;
}

function updatePostsJs(postEntry) {
  const postsJsPath = path.join(ROOT, 'posts.js');
  let content = fs.readFileSync(postsJsPath, 'utf8');

  const insertAfter = 'const posts = [';
  const idx = content.indexOf(insertAfter);
  if (idx === -1) {
    throw new Error('Could not find posts array in posts.js');
  }

  const newEntry = `
 {
        tag: "${postEntry.tag}",
        date: "${postEntry.date}",
        pain: "${postEntry.pain}",
        swelling: "${postEntry.swelling}",
        title: "${postEntry.title.replace(/"/g, '\\"')}",
        description: "${postEntry.description.replace(/"/g, '\\"')}",
        image: "${postEntry.image}",
        link: "${postEntry.link}"
    },`;

  content = content.slice(0, idx + insertAfter.length) + newEntry + content.slice(idx + insertAfter.length);
  fs.writeFileSync(postsJsPath, content, 'utf8');
}

function handleCreatePost(req, res) {
  if (!checkAuth(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const form = new IncomingForm({
    uploadDir: path.join(ROOT, 'images'),
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      return sendJson(res, 400, { error: 'Failed to parse form data: ' + err.message });
    }

    try {
      const getField = (name) => {
        const val = fields[name];
        if (Array.isArray(val)) return val[0];
        return val || '';
      };

      const dayNumber = getField('dayNumber');
      const date = getField('date');
      const week = getField('week');
      const title = getField('title');
      const summary = getField('summary');
      const painLevel = getField('painLevel');
      const swelling = getField('swelling');
      const journalEntry = getField('journalEntry');
      const keyTakeaways = getField('keyTakeaways');
      const prevDay = getField('prevDay');
      const prevDayLabel = getField('prevDayLabel');

      if (!dayNumber || !date || !week || !title || !summary || !painLevel || !swelling || !journalEntry || !keyTakeaways) {
        return sendJson(res, 400, { error: 'All fields are required' });
      }

      const photoFile = files.photo;
      const photo = Array.isArray(photoFile) ? photoFile[0] : photoFile;

      if (!photo) {
        return sendJson(res, 400, { error: 'Photo is required' });
      }

      const ext = path.extname(photo.originalFilename || '.jpg');
      const imageName = `Day${dayNumber}${ext}`;
      const imageDest = path.join(ROOT, 'images', imageName);

      fs.renameSync(photo.filepath, imageDest);

      const prevLink = prevDay ? `day-${prevDay}.html` : '';
      const prevLabel = prevDayLabel || (prevDay ? `Day ${prevDay}` : '');

      const postData = {
        dayNumber,
        date,
        week,
        title,
        summary,
        painLevel,
        swelling,
        imageName,
        journalEntry,
        keyTakeaways,
        prevLink,
        prevLabel,
        nextLink: '',
        nextLabel: '',
      };

      const html = generatePostHtml(postData);
      const postFilePath = path.join(ROOT, 'posts', `day-${dayNumber}.html`);
      fs.writeFileSync(postFilePath, html, 'utf8');

      const postsJsEntry = {
        tag: week,
        date,
        pain: `${painLevel}/10`,
        swelling: `${swelling}/10`,
        title,
        description: summary,
        image: `images/${imageName}`,
        link: `posts/day-${dayNumber}.html`,
      };
      updatePostsJs(postsJsEntry);

      if (prevDay) {
        const prevPostPath = path.join(ROOT, 'posts', `day-${prevDay}.html`);
        if (fs.existsSync(prevPostPath)) {
          let prevHtml = fs.readFileSync(prevPostPath, 'utf8');

          if (!prevHtml.includes(`day-${dayNumber}.html`)) {
            const nextNavBlock = `<a href="day-${dayNumber}.html" class="group p-4 border border-gray-200 rounded-xl text-right hover:border-google-blue transition-colors duration-200">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Entry</span>
                    <div class="flex items-center justify-end mt-1 text-gray-900 font-bold group-hover:text-google-blue">
                        Day ${dayNumber}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </a>`;

            const gridCloseNav = '</div>\n        </nav>';
            const navCloseIdx = prevHtml.lastIndexOf('</nav>');
            if (navCloseIdx > -1) {
              const gridCloseIdx = prevHtml.lastIndexOf('</div>', navCloseIdx);
              if (gridCloseIdx > -1) {
                prevHtml = prevHtml.slice(0, gridCloseIdx) + nextNavBlock + '\n            ' + prevHtml.slice(gridCloseIdx);
                fs.writeFileSync(prevPostPath, prevHtml, 'utf8');
              }
            }
          }
        }
      }

      sendJson(res, 200, {
        success: true,
        message: `Post day-${dayNumber}.html created successfully`,
        postFile: `posts/day-${dayNumber}.html`,
        imageFile: `images/${imageName}`,
      });
    } catch (error) {
      sendJson(res, 500, { error: 'Failed to create post: ' + error.message });
    }
  });
}

function handleGetExistingPosts(req, res) {
  if (!checkAuth(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const postsDir = path.join(ROOT, 'posts');
    const files = fs.readdirSync(postsDir).filter(f => f.startsWith('day-') && f.endsWith('.html'));
    const dayNumbers = files.map(f => {
      const match = f.match(/^day-(.+)\.html$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    sendJson(res, 200, { posts: dayNumbers });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to list posts: ' + error.message });
  }
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (urlPath.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }

  if (urlPath === '/api/admin/login') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { password } = JSON.parse(body);
          if (password === ADMIN_PASSWORD) {
            const token = createSession();
            sendJson(res, 200, { success: true, token });
          } else {
            sendJson(res, 401, { error: 'Invalid password' });
          }
        } catch (e) {
          sendJson(res, 400, { error: 'Invalid request' });
        }
      });
    } else if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const password = url.searchParams.get('p');
      if (password && password === ADMIN_PASSWORD) {
        const token = createSession();
        sendJson(res, 200, { success: true, token });
      } else {
        sendJson(res, 401, { error: 'Invalid password' });
      }
    } else {
      sendJson(res, 405, { error: 'Method not allowed' });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/admin/create-post') {
    return handleCreatePost(req, res);
  }

  if (req.method === 'GET' && urlPath === '/api/admin/posts') {
    return handleGetExistingPosts(req, res);
  }

  if (urlPath.startsWith('/api/')) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed', method: req.method, url: req.url }));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
