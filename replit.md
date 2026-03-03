# KneeComeback

A static HTML website for knee recovery guidance (kneecomeback.com).

## Project Structure

- `index.html` - Main homepage
- `about.html` - About page
- `tips.html` - Recovery tips
- `exercises.html` - Exercise guides
- `posts/` - Daily recovery journal posts (day-0.html through day-100.html)
- `product/` - Product recommendation pages
- `css/` - Stylesheets
- `images/` - Photo assets
- `pl/` - Polish language version
- `pt/` - Portuguese language version
- `posts.js` - Post data/navigation JavaScript
- `server.js` - Simple Node.js static file server

## Running the Project

The app is served via a Node.js static HTTP server:

```
node server.js
```

Runs on port 5000 at `http://0.0.0.0:5000`.

## Deployment

Configured as a **static** deployment with the root directory as the public folder.
