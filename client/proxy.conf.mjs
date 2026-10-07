// Dev server proxy: the browser only talks to the Angular dev server, so the
// API's auth cookie is same-origin and the API needs no CORS setup.
const target = 'http://localhost:5017';

// /login and /signup are also client-side pages. A browser navigation (a GET
// that accepts HTML) is served by Angular; API calls are forwarded.
function servePageForNavigation(req) {
  if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
    return '/index.html';
  }
  return undefined;
}

const paths = ['/photos', '/login', '/logout', '/signup', '/me', '/config', '/health'];

export default Object.fromEntries(
  paths.map((path) => [
    path,
    { target, changeOrigin: false, secure: false, bypass: servePageForNavigation },
  ]),
);
