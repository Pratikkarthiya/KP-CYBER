/**
 * Cloudflare Worker Entry Point for KP Cyber Portal
 * 
 * Proxies API requests (/api/* and /uploads/*) to the live backend server
 * and serves static assets from ./public
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight handling
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Proxy API and Upload routes to backend server
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      const backendHost = env.BACKEND_URL || 'http://localhost:3000';
      const targetUrl = new URL(url.pathname + url.search, backendHost);

      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', url.hostname);
      headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      try {
        const proxyResponse = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'follow',
        });

        // Clone response and attach CORS headers
        const newHeaders = new Headers(proxyResponse.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Credentials', 'true');

        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: newHeaders,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Unable to reach backend service. Please ensure server.js and Cloudflare Tunnel are active.',
            error: err.message,
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Serve static assets if configured
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
