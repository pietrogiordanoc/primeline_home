export const adaptNetlifyHandler = (handler) => async (request) => {
  const headers = Object.fromEntries(request.headers.entries());
  if (!headers.host) headers.host = new URL(request.url).host;
  const event = {
    httpMethod: request.method,
    headers,
    body: request.body === null ? null : await request.text(),
    isBase64Encoded: false
  };
  const result = await handler(event);
  const responseHeaders = new Headers(result.headers);

  for (const [name, values] of Object.entries(result.multiValueHeaders || {})) {
    for (const value of values) responseHeaders.append(name, value);
  }

  return new Response(result.body, { status: result.statusCode, headers: responseHeaders });
};
