#!/usr/bin/env python3
"""
HTTP Server for SIP Frontend
Serves files from the frontend directory on port 8000, and routes /uploads/ to backend/uploads
"""

import os
import sys
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(base_dir, 'frontend')
backend_uploads_path = os.path.join(base_dir, 'backend', 'uploads')
os.chdir(frontend_path)

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # If request is for /uploads/..., serve directly from backend/uploads directory
        if self.path.startswith('/uploads/'):
            filename = self.path[len('/uploads/'):].split('?')[0].split('#')[0]
            file_path = os.path.join(backend_uploads_path, filename)
            if os.path.isfile(file_path):
                self.send_response(200)
                content_type, _ = mimetypes.guess_type(file_path)
                self.send_header('Content-Type', content_type or 'image/jpeg')
                self.send_header('Content-Length', str(os.path.getsize(file_path)))
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "File not found in uploads directory")
                return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[HTTP] {format % args}")

if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"[START] Serving SIP Frontend from: {frontend_path}")
    print(f"[INFO] Uploads served from: {backend_uploads_path}")
    print(f"[INFO] Access at: http://localhost:{port}")
    print(f"[INFO] Press Ctrl+C to stop\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[DONE] Server stopped")
        sys.exit(0)
