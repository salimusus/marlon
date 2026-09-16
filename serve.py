"""Local-only development server. Python 3; no third-party dependency."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import webbrowser

if __name__ == '__main__':
    root = str(Path(__file__).resolve().parent)
    server = ThreadingHTTPServer(('127.0.0.1', 8080), partial(SimpleHTTPRequestHandler, directory=root))
    print('MARLON : http://localhost:8080 — Ctrl+C pour arrêter')
    webbrowser.open('http://localhost:8080')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
