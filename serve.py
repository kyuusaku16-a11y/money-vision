#!/usr/bin/env python3
# 開発用サーバー（キャッシュ無効ヘッダ付き）。
# 通常の `python3 -m http.server` はキャッシュ制御ヘッダを送らず、
# 編集後も古いJSが配られ続けることがあるため、開発ではこちらを使う:
#   cd app && python3 serve.py   → http://localhost:8000/
import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print('http://localhost:8000/ (no-cache dev server)')
    http.server.ThreadingHTTPServer(('', 8000), NoCacheHandler).serve_forever()
