# 📱 Accessing KollabX on Mobile

## Quick Start

### Option 1: Using the Script (Easiest)
1. Open Terminal
2. Navigate to the project folder:
   ```bash
   cd /Users/deepanshu/Documents/GitHub/KollabX
   ```
3. Run the server script:
   ```bash
   ./start-server.sh
   ```
4. The script will show your IP address and start the server
5. On your phone, open: `http://YOUR_IP:8000`

### Option 2: Manual Python Server
1. Open Terminal
2. Navigate to the project folder:
   ```bash
   cd /Users/deepanshu/Documents/GitHub/KollabX
   ```
3. Start Python server:
   ```bash
   python3 -m http.server 8000
   ```
4. Find your IP address:
   - **macOS**: System Settings > Network > WiFi > Details (look for IPv4 address)
   - Or run: `ifconfig | grep "inet " | grep -v 127.0.0.1`
5. On your phone, open: `http://YOUR_IP:8000`

### Option 3: VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"
4. The extension will show the URL in the status bar
5. Use that URL on your phone (make sure both devices are on same WiFi)

## Finding Your IP Address

### macOS:
1. **System Settings Method**:
   - Open System Settings
   - Click "Network"
   - Select "WiFi" (or your active connection)
   - Click "Details"
   - Look for "IPv4 Address" (e.g., 192.168.1.100)

2. **Terminal Method**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Look for something like `inet 192.168.1.100`

### Windows:
1. Open Command Prompt
2. Run: `ipconfig`
3. Look for "IPv4 Address" under your WiFi adapter

### Linux:
```bash
hostname -I
```
or
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

## Important Notes

⚠️ **Both devices must be on the same WiFi network**

✅ The server must be running for mobile access to work

✅ Use `http://` not `https://` for local development

✅ If you can't access it:
   - Check firewall settings
   - Make sure both devices are on the same network
   - Try disabling VPN if active
   - Check that the port (8000) isn't blocked

## Example URLs

If your IP is `192.168.1.100`, use:
- `http://192.168.1.100:8000`
- `http://192.168.1.100:8000/index.html`
- `http://192.168.1.100:8000/explore.html`

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.
