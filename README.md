# Swiss Water Level Monitor

Automatically monitor water levels at Swiss hydrological station #2018 (Reuss - Mellingen) and receive notifications when thresholds are exceeded.

## Features

- 🌊 Monitors water level data from the Swiss government hydrology service
- 🔔 Sends alerts when water levels cross your defined threshold
- 📱 Supports both email and mobile push notifications (via Pushover)
- 🤖 Runs automatically via GitHub Actions (no server needed)

## Setup

### 1. Clone and Configure

1. Clone this repository
2. Install dependencies:
   ```
   npm install axios cheerio nodemailer form-data
   ```
3. Edit `water-monitor.js` to configure your preferences:
   - Set your desired water level threshold
   - Configure notification methods (email and/or Pushover)

### 2. GitHub Actions Setup

1. Push this repository to GitHub
2. Add GitHub secrets for your credentials:
   - `EMAIL_PASSWORD`: Your email app password
   - `PUSHOVER_TOKEN`: Your Pushover app token (optional)
   - `PUSHOVER_USER`: Your Pushover user key (optional)
3. GitHub Actions will automatically run the script every 6 hours

### 3. Local Testing

Run the script manually with:
```
node water-monitor.js
```

## Configuration Options

```javascript
// In water-monitor.js
const config = {
  threshold: 345.00, // Set your water level threshold (m.ü.M)
  checkIfAbove: true, // true to alert when above threshold, false when below
  
  email: {
    enabled: true, // Set to false to disable email alerts
    // Email configuration...
  },
  
  pushover: {
    enabled: true, // Set to false to disable push notifications
    // Pushover configuration...
  }
};
```

## License

MIT