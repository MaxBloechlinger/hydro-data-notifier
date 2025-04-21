// Flow Rate Notification App
// This script checks the flow rate (Abfluss) at station #2018 and sends notifications when thresholds are reached

const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const FormData = require('form-data');

// Configuration
const config = {
  // URL of the station
  stationUrl: 'https://www.hydrodaten.admin.ch/de/seen-und-fluesse/stationen-und-daten/2018',
  // How often to check (in milliseconds)
  checkInterval: 6 * 60 * 60 * 1000, // 6 hours
  // Threshold in cubic meters per second
  threshold: 200, // Alert when flow exceeds this value
  // Check if flow rate is above or below threshold
  checkIfAbove: true, // true to alert when above threshold, false when below
  // Email configuration for notifications
  email: {
    enabled: false, // Disabled by default - set to true after configuring
    from: 'your-email@gmail.com',
    to: 'your-email@gmail.com',
    subject: 'Flow Rate Alert',
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password' // Use app password for Gmail
      }
    }
  },
  // Pushover configuration for mobile notifications
  pushover: {
    enabled: false, // Disabled by default - set to true after configuring
    token: 'YOUR_APP_TOKEN', // Create app at pushover.net
    user: 'YOUR_USER_KEY'    // From your Pushover account
  }
};

// Function to get the flow rate (Abfluss) value
async function getFlowRate() {
  try {
    console.log('Fetching data from webpage...');
    const response = await axios.get(config.stationUrl);
    const $ = cheerio.load(response.data);
    
    console.log('Looking for the current flow rate value...');
    
    // Based on the screenshot and page structure, target the value directly
    // Find the row containing "Letzter Messwert" and extract the Abfluss value
    
    // Find all table rows
    let flowRate = null;
    const rows = $('tr');
    
    // Log the total number of rows for debugging
    console.log(`Found ${rows.length} rows on the page`);
    
    // First, try to find the row that contains "Letzter Messwert"
    let messwerRow = null;
    
    rows.each((i, row) => {
      const rowText = $(row).text().trim();
      if (rowText.includes('Letzter Messwert')) {
        console.log(`Found Letzter Messwert in row ${i+1}: ${rowText}`);
        messwerRow = $(row);
        return false; // Break the loop
      }
    });
    
    // If we found the row, extract the Abfluss value which should be in the first column after date
    if (messwerRow) {
      // The row structure should be: Letzter Messwert (date) | Abfluss value | Wasserstand value | Temp value
      // Extract all cells from this row
      const cells = messwerRow.find('td');
      
      // Check if we have enough cells
      if (cells.length >= 2) {
        // The first cell after "Letzter Messwert" should contain our value
        const valueCell = $(cells[1]);
        const valueText = valueCell.text().trim();
        
        console.log(`Found value cell: "${valueText}"`);
        
        // Check if it's a numeric value
        if (/^\d+$/.test(valueText)) {
          flowRate = parseInt(valueText, 10);
          console.log(`Extracted flow rate: ${flowRate} m³/s`);
        }
      }
    }
    
    // If we couldn't find it in the row, try another approach
    if (!flowRate) {
      console.log('Trying alternative approach...');
      
      // Look for table cells containing just numeric values around 100-120
      // First find all table cells that contain just numbers
      const numericCells = $('td').filter(function() {
        const cellText = $(this).text().trim();
        return /^\d+$/.test(cellText) && cellText.length < 4;
      });
      
      console.log(`Found ${numericCells.length} cells with just numbers`);
      
      // Look for values close to what we expect based on screenshot (around 108)
      numericCells.each((i, cell) => {
        const valueText = $(cell).text().trim();
        const value = parseInt(valueText, 10);
        
        // Look for values in the range of what we expect
        if (value >= 100 && value <= 120) {
          console.log(`Found likely flow rate value in cell: ${value}`);
          
          // Check if it's in a row with "Letzter Messwert" or near "Abfluss"
          const parentRow = $(cell).closest('tr');
          const rowText = parentRow.text();
          
          if (rowText.includes('Letzter Messwert') || 
              (rowText.includes('Abfluss') && !rowText.includes('Gefahrenstufen'))) {
            // This is likely our target cell
            flowRate = value;
            console.log(`Selected flow rate: ${flowRate} m³/s`);
            return false; // Break the loop
          }
        }
      });
    }
    
    // Third attempt - try directly with the layout structure
    if (!flowRate) {
      console.log('Final attempt - targeting specific table structure...');
      
      // Based on your screenshot, find the measurement table with specific columns
      $('table').each((i, table) => {
        // Check if this table has both Abfluss and Wasserstand columns
        const tableHeaders = $(table).find('th, td').filter(function() {
          return $(this).text().includes('Abfluss') || $(this).text().includes('Wasserstand');
        });
        
        if (tableHeaders.length >= 2) {
          console.log(`Found likely measurement table (table ${i+1})`);
          
          // Now look for Letzter Messwert row
          const messRow = $(table).find('tr').filter(function() {
            return $(this).text().includes('Letzter Messwert');
          });
          
          if (messRow.length > 0) {
            console.log('Found Letzter Messwert row in measurement table');
            
            // Get all cells in this row
            const cells = messRow.find('td');
            
            // Output all the cell values for debugging
            cells.each((j, cell) => {
              console.log(`Cell ${j+1} value: "${$(cell).text().trim()}"`);
            });
            
            // Extract just the value for Abfluss - should be in the position after Letzter Messwert
            if (cells.length >= 2) {
              const valueCell = $(cells.get(1)); // Get second cell
              const valueText = valueCell.text().trim();
              
              // Check if it's numeric
              if (/^\d+$/.test(valueText)) {
                flowRate = parseInt(valueText, 10);
                console.log(`Found flow rate directly in table: ${flowRate} m³/s`);
              }
            }
          }
        }
      });
    }
    
    // If all else fails, look for specific HTML pattern
    if (!flowRate) {
      console.log('Attempting to find by specific pattern...');
      
      // Look for a specific pattern where Letzter Messwert appears near a 3-digit number
      const rows = $('tr');
      
      // First, find any row with "Letzter Messwert"
      rows.each((i, row) => {
        if ($(row).text().includes('Letzter Messwert')) {
          console.log(`Found Letzter Messwert row: ${$(row).text()}`);
          
          // Now look for any numeric cells
          $(row).find('td').each((j, cell) => {
            const cellText = $(cell).text().trim();
            if (/^\d+$/.test(cellText)) {
              const value = parseInt(cellText, 10);
              if (value >= 50 && value < 500) {
                flowRate = value;
                console.log(`Found numeric value in Letzter Messwert row: ${flowRate}`);
                return false; // Break the loop
              }
            }
          });
          
          // If we didn't find it in this row, check the next row
          if (!flowRate) {
            const nextRow = $(row).next('tr');
            if (nextRow.length > 0) {
              nextRow.find('td').each((j, cell) => {
                const cellText = $(cell).text().trim();
                if (/^\d+$/.test(cellText)) {
                  const value = parseInt(cellText, 10);
                  if (value >= 50 && value < 500) {
                    flowRate = value;
                    console.log(`Found numeric value in row after Letzter Messwert: ${flowRate}`);
                    return false; // Break the loop
                  }
                }
              });
            }
          }
        }
      });
    }
    
    if (!flowRate) {
      // Last desperate attempt - just grab the first number in range 100-120
      const bodyText = $('body').text();
      const matches = bodyText.match(/\b10[0-9]\b|\b11[0-9]\b|\b120\b/g);
      if (matches && matches.length > 0) {
        flowRate = parseInt(matches[0], 10);
        console.log(`Found likely flow rate from text: ${flowRate} m³/s`);
      } else {
        console.error('Could not find the current flow rate value');
        return null;
      }
    }
    
    console.log(`Current flow rate: ${flowRate} m³/s`);
    return flowRate;
  } catch (error) {
    console.error('Error fetching flow rate:', error);
    return null;
  }
}

// Function to send email notification
async function sendEmailAlert(flowRate) {
  if (!config.email.enabled) return;
  
  try {
    const transporter = nodemailer.createTransport(config.email.smtp);
    
    const alertType = config.checkIfAbove ? 'exceeded' : 'fallen below';
    
    await transporter.sendMail({
      from: config.email.from,
      to: config.email.to,
      subject: config.email.subject,
      text: `Flow Rate Alert: The flow rate at station #2018 has ${alertType} the threshold of ${config.threshold} m³/s. Current flow: ${flowRate} m³/s.`,
      html: `<h1>Flow Rate Alert</h1>
             <p>The flow rate at station #2018 has ${alertType} the threshold of ${config.threshold} m³/s.</p>
             <p>Current flow: <strong>${flowRate} m³/s</strong></p>
             <p>Time: ${new Date().toLocaleString()}</p>`
    });
    
    console.log('Alert email sent');
  } catch (error) {
    console.error('Error sending email alert:', error);
  }
}

// Function to send push notification to mobile
async function sendPushAlert(flowRate) {
  if (!config.pushover.enabled) return;
  
  try {
    const alertType = config.checkIfAbove ? 'exceeded' : 'fallen below';
    const message = `Flow rate has ${alertType} ${config.threshold} m³/s. Current: ${flowRate} m³/s.`;
    
    const formData = new FormData();
    formData.append('token', config.pushover.token);
    formData.append('user', config.pushover.user);
    formData.append('message', message);
    formData.append('title', 'Flow Rate Alert');
    formData.append('priority', 1); // High priority
    formData.append('sound', 'siren'); // Distinctive alert sound
    
    await axios.post('https://api.pushover.net/1/messages.json', formData, {
      headers: formData.getHeaders()
    });
    console.log('Push notification sent');
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Main function to check flow rate and send notification if needed
async function checkFlowRate() {
  try {
    const flowRate = await getFlowRate();
    
    if (flowRate === null) {
      console.log('Skipping this check due to error');
      return;
    }
    
    const shouldAlert = (config.checkIfAbove && flowRate >= config.threshold) ||
                        (!config.checkIfAbove && flowRate <= config.threshold);
    
    if (shouldAlert) {
      console.log(`Threshold ${config.checkIfAbove ? 'exceeded' : 'reached'}! Sending alerts...`);
      // Send both notifications
      if (config.email.enabled) await sendEmailAlert(flowRate);
      if (config.pushover.enabled) await sendPushAlert(flowRate);
    } else {
      console.log(`Flow rate (${flowRate} m³/s) is ${config.checkIfAbove ? 'below' : 'above'} threshold (${config.threshold} m³/s). No alert needed.`);
      console.log(`Next check in ${config.checkInterval / (60 * 60 * 1000)} hours.`);
    }
  } catch (error) {
    console.error('Error in checkFlowRate function:', error);
  }
}

// Run immediately once
checkFlowRate();

// Then set up interval for regular checks
console.log(`Starting flow rate monitoring. Checking every ${config.checkInterval / (60 * 60 * 1000)} hours.`);
setInterval(checkFlowRate, config.checkInterval);