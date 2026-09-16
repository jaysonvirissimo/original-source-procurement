// The fixtures build adds an OSP-authored field mission to the shipped
// curriculum, so browser tests can load a real mission from intercepted
// upstream hosts. It is served beside the production build on its own port.

export const FIXTURE_PORT = 4174;

export const FIXTURE_BASE_URL = `http://127.0.0.1:${String(FIXTURE_PORT)}/original-source-procurement/`;
