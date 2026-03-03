# KneeComeback

A static HTML website for knee recovery guidance (kneecomeback.com) with a built-in admin CMS.

## Project Structure

- `index.html` - Main homepage with timeline
- `about.html` - About page
- `tips.html` - Recovery tips
- `exercises.html` - Exercise guides
- `posts/` - Daily recovery journal posts (day-0.html through day-100+.html)
- `posts.js` - Post data array used by index.html to render the timeline
- `product/` - Product recommendation pages
- `css/` - Stylesheets
- `images/` - Photo assets (naming: Day{number}.jpg)
- `pl/` - Polish language version
- `pt/` - Portuguese language version
- `admin/` - Admin panel for creating new journal entries
- `server.js` - Node.js server (static files + admin API)

## Dependencies

- `formidable` - Multipart form data parsing for photo uploads

## Admin Panel

Accessible at `/admin`. Password-protected using the `ADMIN_PASSWORD` environment secret.

Features:
- Create new journal posts with all fields (date, week, title, summary, pain, swelling, photo, journal entry, key takeaways)
- Automatically generates post HTML file in `posts/` following existing structure and style
- Saves uploaded photo to `images/` with correct naming (Day{number}.ext)
- Prepends new entry to `posts.js` so it appears first on the timeline
- Includes Google Analytics, meta tags, Open Graph, and Twitter card tags
- Preview before publishing
- Navigation links to previous/next entries

## Running the Project

```
node server.js
```

Runs on port 5000 at `http://0.0.0.0:5000`.

## Deployment

Configured as **autoscale** deployment with `node server.js` as the run command.
