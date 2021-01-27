import os
from http.server import HTTPServer, CGIHTTPRequestHandler

def run_server():
    # Make sure the server is created at current directory
    os.chdir('.')
    # Create server object listening the port 3000
    REPL_interface = HTTPServer(server_address=('', 3000), RequestHandlerClass=CGIHTTPRequestHandler)
    # Start the web server
    REPL_interface.serve_forever()