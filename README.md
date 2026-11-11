# Petrol Pump Management System

A complete petrol pump management and accounting application built with Node.js, Express, and SQLite.

## Features

- Role-based access control for owner and staff
- Machine and nozzle management
- Two-shift accounting and carry-forward meter logic
- Miscellaneous collections and payment tracking
- Automatic reconciliation and cash verification
- Daily dashboard with filters
- AI accounting assistant with alerts in Hindi/English
- Reports and export-ready data layer
- SQLite-backed permanent record storage

## Default login

- Owner: `admin` / `admin123`
- Employee: `emp1` / `emp123`

## Run locally

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Project structure

- `server.js` - API server, DB setup and business logic
- `public/index.html` - app shell and responsive UI
- `public/styles.css` - premium responsive styling
- `public/app.js` - frontend interactions and dashboard rendering
- `data/petrol_pump.db` - SQLite database created at runtime

## Notes

This application is designed for an Indian petrol pump and uses INR values and Indian standard time defaults.
