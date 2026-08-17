const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

function ok(body) {
  return json(200, body);
}

function badRequest(message) {
  return json(400, { error: message });
}

function notFound(message) {
  return json(404, { error: message });
}

function serverError(err) {
  console.error(err);
  return json(500, { error: 'Internal server error' });
}

module.exports = { ok, badRequest, notFound, serverError, json };
