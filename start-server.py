#!/usr/bin/env python3
"""
HTTP Server for SIP Frontend
Serves files from the frontend directory on port 8000
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Change to frontend directory
frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
os.chdir(frontend_path)

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[HTTP] {format % args}")

if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"[START] Serving SIP Frontend from: {frontend_path}")
    print(f"[INFO] Access at: http://localhost:{port}")
    print(f"[INFO] Press Ctrl+C to stop\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[DONE] Server stopped")
        sys.exit(0)
