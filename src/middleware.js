/** @typedef {import('./bindings').Context} Context */

/**
 * Adds CORS preflight headers to the response.
 * @type {import('./bindings').Middleware<Context>}
 */
export function withCORSPreflight (handler) {
  return async (request, env, ctx) => {
    if (request.method !== 'OPTIONS') {
      return handler(request, env, ctx)
    }

    const { headers } = request
    // Make sure the necessary headers are present for this to be a valid pre-flight request
    if (
      headers.get('Origin') != null &&
      headers.get('Access-Control-Request-Method') != null &&
      headers.get('Access-Control-Request-Headers') != null
    ) {
      /** @type {Record<string, string>} */
      const respHeaders = {
        'Content-Length': '0',
        'Access-Control-Allow-Origin': headers.get('origin') || '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Max-Age': '86400',
        // Allow all future content Request headers to go back to browser
        // such as Authorization (Bearer) or X-Client-Name-Version
        'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers') ?? ''
      }

      return new Response(undefined, { status: 204, headers: respHeaders })
    }

    return new Response('non CORS options request not allowed', { status: 405 })
  }
}

/**
 * Adds CORS headers to the response.
 * @type {import('./bindings').Middleware<Context>}
 */
export function withCORSHeaders (handler) {
  return async (request, env, ctx) => {
    const response = await handler(request, env, ctx)
    const origin = request.headers.get('origin')
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
      response.headers.set('Vary', 'Origin')
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*')
    }
    return response
  }
}

/**
 * Catches any errors, logs them and returns a suitable response.
 * @type {import('./bindings').Middleware<Context>}
 */
export function withErrorHandler (handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx)
    } catch (/** @type {any} */ err) {
      if (!err.status || err.status >= 500) console.error(err.stack)
      const msg = env.DEBUG === 'true'
        ? `${err.stack}${err?.cause?.stack ? `\n[cause]: ${err.cause.stack}` : ''}`
        : err.message
      return new Response(msg, { status: err.status || 500 })
    }
  }
}

/**
 * Validates the request uses a HTTP POST method.
 * @type {import('./bindings').Middleware<Context>}
 */
export function withHTTPPost (handler) {
  return (request, env, ctx) => {
    if (request.method !== 'POST') {
      throw Object.assign(new Error('method not allowed'), { status: 405 })
    }
    return handler(request, env, ctx)
  }
}

/**
 * @param {...import('./bindings').Middleware<any, any, any>} middlewares
 * @returns {import('./bindings').Middleware<any, any, any>}
 */
export function composeMiddleware (...middlewares) {
  return handler => middlewares.reduceRight((h, m) => m(h), handler)
}
