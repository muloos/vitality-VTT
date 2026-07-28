#!/usr/bin/env python3
"""Servidor estático simples para o Vitality VTT — SEM cache, multi-thread.

Uso:  python serve.py [porta]   (porta padrão: 5500)

- Envia cabeçalhos no-cache em tudo, então o navegador sempre pega a versão
  mais nova dos arquivos (evita ter que dar Ctrl+F5 a cada mudança).
- Usa ThreadingHTTPServer: cada conexão roda em sua própria thread. Sem isso,
  o servidor atende uma requisição por vez e uma aba/usuário trava até a outra
  agir (head-of-line blocking com conexões keep-alive/especulativas do navegador).
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    # HTTP/1.1 (com Content-Length) permite keep-alive; seguro porque cada
    # conexão está isolada em sua própria thread.
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 5500))
    ThreadingHTTPServer.allow_reuse_address = True
    with ThreadingHTTPServer(("", port), NoCacheHandler) as httpd:
        print(f"Vitality VTT rodando em http://localhost:{port}/login.html  (sem cache, multi-thread)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrado.")
