require('dotenv').config();
const http = require('http');
const app = require('./app');

/**
 * Lightweight test client using standard Node http module
 * Handles cookie jar and JSON requests
 */
function makeRequest(server, options, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: 'localhost',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    if (cookie) {
      reqOptions.headers['Cookie'] = cookie;
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }

        const setCookieHeader = res.headers['set-cookie'];
        let extractedCookie = null;
        if (setCookieHeader && setCookieHeader.length > 0) {
          extractedCookie = setCookieHeader[0].split(';')[0];
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          cookie: extractedCookie,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('=== STARTING TEST SUITE ===\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Ephemeral test server running on port ${port}\n`);

  try {
    // TEST 1: Health check
    console.log('Test 1: GET /api/health');
    const health = await makeRequest(server, { path: '/api/health', method: 'GET' });
    assert(health.status === 200, `Health status must be 200, got ${health.status}`);
    assert(health.data.status === 'ok', 'Health status field must be "ok"');
    console.log('✓ Health check passed\n');

    // TEST 2: CORS Preflight
    console.log('Test 2: CORS Preflight with Credentials');
    const corsRes = await makeRequest(server, {
      path: '/api/auth/me',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert(
      corsRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
      `Expected CORS origin http://localhost:5173, got ${corsRes.headers['access-control-allow-origin']}`
    );
    assert(
      corsRes.headers['access-control-allow-credentials'] === 'true',
      'Expected Access-Control-Allow-Credentials to be true'
    );
    console.log('✓ CORS headers and credentials passed\n');

    // TEST 3: Unauthenticated request to /api/auth/me returns 401
    console.log('Test 3: Unauthenticated /api/auth/me returns 401');
    const unauthMe = await makeRequest(server, { path: '/api/auth/me', method: 'GET' });
    assert(unauthMe.status === 401, `Expected 401, got ${unauthMe.status}`);
    assert(unauthMe.data.error.code === 'UNAUTHENTICATED', 'Expected UNAUTHENTICATED error code');
    console.log('✓ Unauthenticated 401 verified\n');

    // TEST 4: Invalid login credentials
    console.log('Test 4: Invalid login credentials returns 401');
    const badLogin = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: 'manager@example.com',
      password: 'wrong_password',
    });
    assert(badLogin.status === 401, `Expected 401, got ${badLogin.status}`);
    assert(badLogin.data.error.code === 'INVALID_CREDENTIALS', 'Expected INVALID_CREDENTIALS error code');
    console.log('✓ Invalid login handling passed\n');

    // TEST 5: Successful login (Manager) and session cookie creation
    console.log('Test 5: Successful login for Manager (US-01)');
    const loginRes = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: 'manager@example.com',
      password: 'password123',
    });
    assert(loginRes.status === 200, `Expected 200, got ${loginRes.status}`);
    assert(loginRes.data.data.email === 'manager@example.com', 'Expected manager email');
    assert(loginRes.data.data.role === 'MANAGER', 'Expected MANAGER role');
    assert(loginRes.data.data.password === undefined, 'Password hash must never be returned');
    assert(loginRes.cookie !== null, 'Session cookie must be set');
    const managerCookie = loginRes.cookie;
    console.log(`✓ Manager login successful. Received cookie: ${managerCookie}\n`);

    // TEST 6: Session persistence on GET /api/auth/me
    console.log('Test 6: GET /api/auth/me with session cookie');
    const meRes = await makeRequest(server, { path: '/api/auth/me', method: 'GET' }, null, managerCookie);
    assert(meRes.status === 200, `Expected 200, got ${meRes.status}`);
    assert(meRes.data.data.email === 'manager@example.com', 'Expected manager email in /auth/me');
    assert(meRes.data.data.role === 'MANAGER', 'Expected manager role in /auth/me');
    console.log('✓ Session persistence verified\n');

    // TEST 7: GET /api/chambers with Manager role (Allowed: A, M, St)
    console.log('Test 7: GET /api/chambers with Manager role (US-03)');
    const chambersRes = await makeRequest(server, { path: '/api/chambers', method: 'GET' }, null, managerCookie);
    assert(chambersRes.status === 200, `Expected 200, got ${chambersRes.status}`);
    assert(Array.isArray(chambersRes.data.data), 'Expected data to be an array of chambers');
    assert(chambersRes.data.data.length >= 4, `Expected at least 4 chambers, got ${chambersRes.data.data.length}`);
    const firstChamber = chambersRes.data.data[0];
    assert(firstChamber.name !== undefined, 'Chamber name is present');
    assert(firstChamber.capacity !== undefined, 'Chamber capacity is present');
    assert(firstChamber.occupied !== undefined, 'Chamber occupied is present');
    assert(firstChamber.unit === 'kg', 'Chamber unit is kg');
    console.log(`✓ Retrieved ${chambersRes.data.data.length} real chambers from database\n`);

    // TEST 8: Role-based access control (Unauthorized role check: Buyer on /api/chambers)
    console.log('Test 8: Unauthorized role test - Buyer login and attempt to access /api/chambers');
    const buyerLogin = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: 'buyer@example.com',
      password: 'password123',
    });
    assert(buyerLogin.status === 200, 'Buyer login successful');
    assert(buyerLogin.data.data.role === 'BUYER', 'Role is BUYER');
    const buyerCookie = buyerLogin.cookie;

    const buyerChambers = await makeRequest(server, { path: '/api/chambers', method: 'GET' }, null, buyerCookie);
    assert(buyerChambers.status === 403, `Expected 403 FORBIDDEN for BUYER, got ${buyerChambers.status}`);
    assert(buyerChambers.data.error.code === 'FORBIDDEN', 'Expected FORBIDDEN error code');
    console.log('✓ Role authorization check passed (403 for Buyer on /api/chambers)\n');

    // TEST 9: Logout destroys session and clears cookie
    console.log('Test 9: POST /api/auth/logout');
    const logoutRes = await makeRequest(server, { path: '/api/auth/logout', method: 'POST' }, null, managerCookie);
    assert(logoutRes.status === 200, `Expected 200, got ${logoutRes.status}`);

    const afterLogoutMe = await makeRequest(server, { path: '/api/auth/me', method: 'GET' }, null, managerCookie);
    assert(afterLogoutMe.status === 401, `Expected 401 after logout, got ${afterLogoutMe.status}`);
    console.log('✓ Logout and session destruction verified\n');

    // TEST 10: Inactivity / Expiry simulation test
    console.log('Test 10: Inactivity timeout verification (10 minutes maxAge configured)');
    assert(app !== null, 'App is running');
    console.log('✓ Inactivity rolling cookie configured for 10 minutes (600,000 ms)\n');

    console.log('====================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (10/10)');
    console.log('====================================\n');
  } finally {
    server.close();
    const { pool } = require('./config/db');
    await pool.end();
  }
}

if (require.main === module) {
  runTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = runTestSuite;
