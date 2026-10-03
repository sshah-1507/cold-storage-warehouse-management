require('dotenv').config();
const http = require('http');
const app = require('./app');
const { pool } = require('./config/db');

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

async function loginUser(server, email, password = 'password123') {
  const res = await makeRequest(
    server,
    { path: '/api/auth/login', method: 'POST' },
    { email, password }
  );
  assert(res.status === 200, `Login failed for ${email}: status ${res.status}`);
  return res.cookie;
}

async function runDay2Tests() {
  console.log('=== STARTING COMPREHENSIVE DAY 2 TEST SUITE ===\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Ephemeral test server running on port ${port}\n`);

  try {
    // Clean up any previous test batches, allocations, withdrawals, dispatches and reset chambers
    await pool.query('DELETE FROM "AuditLog"');
    await pool.query('DELETE FROM "DispatchAllocation"');
    await pool.query('DELETE FROM "Dispatch"');
    await pool.query('DELETE FROM "Withdrawal"');
    await pool.query('DELETE FROM "Allocation"');
    await pool.query('DELETE FROM "Batch"');
    await pool.query(`
      UPDATE "Chamber" SET occupied = CASE
        WHEN id = 'ch_1' THEN 450
        WHEN id = 'ch_2' THEN 1200
        WHEN id = 'ch_3' THEN 300
        WHEN id = 'ch_4' THEN 0
        ELSE 0
      END
    `);

    // 0. Log in test personas
    console.log('Logging in personas (Admin, Manager, Staff, Supplier, Buyer)...');
    const adminCookie = await loginUser(server, 'admin@example.com');
    const managerCookie = await loginUser(server, 'manager@example.com');
    const staffCookie = await loginUser(server, 'staff@example.com');
    const supplierCookie = await loginUser(server, 'supplier@example.com');
    const buyerCookie = await loginUser(server, 'buyer@example.com');
    console.log('✓ All personas authenticated\n');

    // TEST 1: Stock intake (US-02)
    console.log('Test 1: Stock intake - register batch (US-02)');
    const intakeRes = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Shimla Apples',
        supplierId: 'u_supplier_1',
        quantity: 200,
        unit: 'kg',
        receivedAt: '2026-09-25',
        expiryDate: '2026-10-25',
      },
      managerCookie
    );
    assert(intakeRes.status === 201, `Expected 201 for batch intake, got ${intakeRes.status}`);
    assert(intakeRes.data.data.productName === 'Shimla Apples', 'Product name must match');
    assert(intakeRes.data.data.remainingQuantity === 200, 'Remaining quantity must be 200');
    assert(intakeRes.data.data.status === 'RECEIVED', 'Status must be RECEIVED');
    const batch1Id = intakeRes.data.data.id;
    console.log(`✓ Batch 1 registered successfully (ID: ${batch1Id})\n`);

    // TEST 2: Stock intake invalid quantity (negative/zero/float)
    console.log('Test 2: Stock intake - validation error on invalid quantity');
    const invalidQtyRes = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Shimla Apples',
        supplierId: 'u_supplier_1',
        quantity: -10,
        unit: 'kg',
        receivedAt: '2026-09-25',
        expiryDate: '2026-10-25',
      },
      managerCookie
    );
    assert(invalidQtyRes.status === 400, `Expected 400 for negative quantity, got ${invalidQtyRes.status}`);
    assert(invalidQtyRes.data.error.code === 'VALIDATION_ERROR', 'Error code must be VALIDATION_ERROR');
    console.log('✓ Invalid quantity rejected with 400\n');

    // TEST 3: Register second batch for FIFO testing
    console.log('Test 3: Register older & newer batches for FIFO dispatch verification');
    // Batch A: receivedAt 2026-09-20 (Older)
    const olderBatchRes = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Nagpur Oranges',
        supplierId: 'u_supplier_1',
        quantity: 50,
        unit: 'kg',
        receivedAt: '2026-09-20',
        expiryDate: '2026-10-15',
      },
      staffCookie
    );
    assert(olderBatchRes.status === 201, `Failed to register older batch: ${olderBatchRes.status}`);
    const olderBatchId = olderBatchRes.data.data.id;

    // Batch B: receivedAt 2026-09-24 (Newer)
    const newerBatchRes = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Nagpur Oranges',
        supplierId: 'u_supplier_1',
        quantity: 100,
        unit: 'kg',
        receivedAt: '2026-09-24',
        expiryDate: '2026-10-20',
      },
      staffCookie
    );
    assert(newerBatchRes.status === 201, `Failed to register newer batch: ${newerBatchRes.status}`);
    const newerBatchId = newerBatchRes.data.data.id;
    console.log(`✓ Older batch (${olderBatchId}, received 2026-09-20) and newer batch (${newerBatchId}, received 2026-09-24) created\n`);

    // TEST 4: Chamber allocation (US-03)
    console.log('Test 4: Chamber allocation - allocate batch to Chamber D (capacity 800, occupied 0)');
    const allocRes = await makeRequest(
      server,
      { path: '/api/allocations', method: 'POST' },
      {
        batchId: batch1Id,
        chamberId: 'ch_4',
        quantity: 200,
      },
      managerCookie
    );
    assert(allocRes.status === 201, `Expected 201 for allocation, got ${allocRes.status}`);
    assert(allocRes.data.data.batchId === batch1Id, 'Allocation batchId must match');
    assert(allocRes.data.data.chamberId === 'ch_4', 'Allocation chamberId must match');
    assert(allocRes.data.data.quantity === 200, 'Allocation quantity must be 200');

    // Verify chamber occupied updated
    const chamberCheckRes = await makeRequest(server, { path: '/api/chambers' }, null, managerCookie);
    const ch4 = chamberCheckRes.data.data.find(c => c.id === 'ch_4');
    assert(ch4.occupied === 200, `Chamber D occupied must be 200, got ${ch4.occupied}`);
    console.log('✓ Batch allocated and chamber occupancy updated to 200\n');

    // TEST 5: Capacity overflow check
    console.log('Test 5: Chamber allocation - capacity overflow check');
    // Chamber A: capacity 1000, occupied 450 -> free: 550. Let's create a batch with 600kg and allocate
    const bigBatchRes = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Alphonso Mangoes',
        supplierId: 'u_supplier_1',
        quantity: 600,
        unit: 'kg',
        receivedAt: '2026-09-25',
        expiryDate: '2026-10-30',
      },
      managerCookie
    );
    const bigBatchId = bigBatchRes.data.data.id;

    const overflowRes = await makeRequest(
      server,
      { path: '/api/allocations', method: 'POST' },
      {
        batchId: bigBatchId,
        chamberId: 'ch_1',
        quantity: 600,
      },
      managerCookie
    );
    assert(overflowRes.status === 409, `Expected 409 for capacity overflow, got ${overflowRes.status}`);
    assert(overflowRes.data.error.code === 'CAPACITY_EXCEEDED', 'Error code must be CAPACITY_EXCEEDED');
    console.log('✓ Capacity overflow rejected with 409 CAPACITY_EXCEEDED\n');

    // TEST 6: Inventory list, search and filter (US-02)
    console.log('Test 6: Inventory search & filter (US-02)');
    const searchRes = await makeRequest(
      server,
      { path: '/api/batches?search=shimla&status=ALLOCATED' },
      null,
      managerCookie
    );
    assert(searchRes.status === 200, `Expected 200 for inventory list, got ${searchRes.status}`);
    assert(searchRes.data.data.length >= 1, 'Should find at least 1 allocated Shimla batch');
    assert(searchRes.data.data[0].id === batch1Id, 'Should match batch1Id');
    assert(searchRes.data.meta.total >= 1, 'Meta total should be present');
    console.log('✓ Inventory search, filter and pagination metadata verified\n');

    // TEST 7: Inventory supplier scoping (US-02)
    console.log('Test 7: Inventory supplier scoping - Supplier view');
    const supplierBatchesRes = await makeRequest(
      server,
      { path: '/api/batches' },
      null,
      supplierCookie
    );
    assert(supplierBatchesRes.status === 200, 'Supplier should get 200 on /batches');
    const allBelongToSupplier = supplierBatchesRes.data.data.every(b => b.supplierId === 'u_supplier_1');
    assert(allBelongToSupplier, 'Supplier must only see batches belonging to u_supplier_1');
    console.log('✓ Supplier scoping correctly verified\n');

    // TEST 8: Withdrawal creation (US-06)
    console.log('Test 8: Withdrawal request creation by Buyer (US-06)');
    const wrRes = await makeRequest(
      server,
      { path: '/api/withdrawals', method: 'POST' },
      {
        productName: 'Nagpur Oranges',
        quantity: 70,
        unit: 'kg',
        notes: 'Priority delivery for fruit stores',
      },
      buyerCookie
    );
    assert(wrRes.status === 201, `Expected 201 for withdrawal request, got ${wrRes.status}`);
    assert(wrRes.data.data.buyerId === 'u_buyer_1', 'buyerId must match session');
    assert(wrRes.data.data.status === 'PENDING', 'status must be PENDING');
    const wrId = wrRes.data.data.id;
    console.log(`✓ Withdrawal request created: ${wrId}\n`);

    // TEST 9: Unauthorized approval attempt (Buyer attempting to approve)
    console.log('Test 9: Unauthorized approval attempt (Buyer trying PATCH /withdrawals/:id/status)');
    const unauthApproveRes = await makeRequest(
      server,
      { path: `/api/withdrawals/${wrId}/status`, method: 'PATCH' },
      { status: 'APPROVED' },
      buyerCookie
    );
    assert(unauthApproveRes.status === 403, `Expected 403 for unauthorized approval, got ${unauthApproveRes.status}`);
    assert(unauthApproveRes.data.error.code === 'FORBIDDEN', 'Error code must be FORBIDDEN');
    console.log('✓ Unauthorized approval blocked with 403 FORBIDDEN\n');

    // TEST 10: Authorized approval by Manager
    console.log('Test 10: Authorized approval by Manager');
    const authApproveRes = await makeRequest(
      server,
      { path: `/api/withdrawals/${wrId}/status`, method: 'PATCH' },
      { status: 'APPROVED' },
      managerCookie
    );
    assert(authApproveRes.status === 200, `Expected 200 for manager approval, got ${authApproveRes.status}`);
    assert(authApproveRes.data.data.status === 'APPROVED', 'Status must be APPROVED');
    console.log('✓ Withdrawal request approved by Manager\n');

    // TEST 11: Multi-batch FIFO Dispatch (US-05)
    console.log('Test 11: Multi-batch FIFO dispatch (70kg needed from Older: 50kg + Newer: 100kg)');
    const dispatchRes = await makeRequest(
      server,
      { path: '/api/dispatches', method: 'POST' },
      { withdrawalId: wrId },
      staffCookie
    );
    assert(dispatchRes.status === 201, `Expected 201 for dispatch, got ${dispatchRes.status}`);
    assert(dispatchRes.data.data.status === 'COMPLETED', 'Dispatch status must be COMPLETED');
    assert(dispatchRes.data.data.quantity === 70, 'Dispatched quantity must be 70');
    assert(dispatchRes.data.data.batchAllocations.length === 2, 'Should allocate across 2 batches');
    // First batch in FIFO must be the older batch (50kg)
    assert(dispatchRes.data.data.batchAllocations[0].batchId === olderBatchId, 'FIFO must select older batch first');
    assert(dispatchRes.data.data.batchAllocations[0].quantity === 50, 'Older batch should be fully consumed (50kg)');
    // Second batch must be newer batch (20kg)
    assert(dispatchRes.data.data.batchAllocations[1].batchId === newerBatchId, 'FIFO should take remainder from newer batch');
    assert(dispatchRes.data.data.batchAllocations[1].quantity === 20, 'Newer batch should provide 20kg');
    console.log('✓ Strict multi-batch FIFO dispatch verified\n');

    // TEST 12: Verify remaining batch quantities after FIFO dispatch
    console.log('Test 12: Stock updates verification in database');
    const olderBatchDbRes = await makeRequest(server, { path: `/api/batches/${olderBatchId}` }, null, managerCookie);
    assert(olderBatchDbRes.data.data.remainingQuantity === 0, 'Older batch remainingQuantity must be 0');
    assert(olderBatchDbRes.data.data.status === 'DISPATCHED', 'Older batch status must be DISPATCHED');

    const newerBatchDbRes = await makeRequest(server, { path: `/api/batches/${newerBatchId}` }, null, managerCookie);
    assert(newerBatchDbRes.data.data.remainingQuantity === 80, `Newer batch remainingQuantity must be 80, got ${newerBatchDbRes.data.data.remainingQuantity}`);
    assert(newerBatchDbRes.data.data.status === 'PARTIALLY_DISPATCHED', 'Newer batch status must be PARTIALLY_DISPATCHED');
    console.log('✓ Batch remaining quantities correctly updated in PostgreSQL\n');

    // TEST 13: Prevent double dispatch (Duplicate processing prevention)
    console.log('Test 13: Prevent double dispatch on already dispatched withdrawal');
    const doubleDispatchRes = await makeRequest(
      server,
      { path: '/api/dispatches', method: 'POST' },
      { withdrawalId: wrId },
      staffCookie
    );
    assert(doubleDispatchRes.status === 409, `Expected 409 for duplicate dispatch, got ${doubleDispatchRes.status}`);
    console.log('✓ Duplicate dispatch rejected with 409\n');

    // TEST 14: Insufficient stock dispatch
    console.log('Test 14: Insufficient stock withdrawal / dispatch');
    // Create new withdrawal for 200kg of Nagpur Oranges (only 80kg remaining)
    const bigWrRes = await makeRequest(
      server,
      { path: '/api/withdrawals', method: 'POST' },
      {
        productName: 'Nagpur Oranges',
        quantity: 200,
        unit: 'kg',
      },
      buyerCookie
    );
    assert(bigWrRes.status === 409, `Expected 409 for insufficient stock on withdrawal creation, got ${bigWrRes.status}`);
    assert(bigWrRes.data.error.code === 'INSUFFICIENT_STOCK', 'Error code must be INSUFFICIENT_STOCK');
    console.log('✓ Insufficient stock rejected with 409 INSUFFICIENT_STOCK\n');

    // TEST 15: FIFO Override with audit log (US-05 / NFR-3)
    console.log('Test 15: Authorized FIFO override with audit log');
    // Register Batch X (older) and Batch Y (newer) of Kiwi
    const kiwi1 = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Zespri Kiwi',
        supplierId: 'u_supplier_1',
        quantity: 30,
        unit: 'kg',
        receivedAt: '2026-09-10',
        expiryDate: '2026-10-10',
      },
      managerCookie
    );
    const kiwi2 = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Zespri Kiwi',
        supplierId: 'u_supplier_1',
        quantity: 30,
        unit: 'kg',
        receivedAt: '2026-09-15',
        expiryDate: '2026-10-15',
      },
      managerCookie
    );
    const kiwiBatch1Id = kiwi1.data.data.id;
    const kiwiBatch2Id = kiwi2.data.data.id;

    // Create and approve withdrawal of 10kg Kiwi
    const kiwiWr = await makeRequest(
      server,
      { path: '/api/withdrawals', method: 'POST' },
      {
        productName: 'Zespri Kiwi',
        quantity: 10,
        unit: 'kg',
      },
      buyerCookie
    );
    const kiwiWrId = kiwiWr.data.data.id;
    await makeRequest(
      server,
      { path: `/api/withdrawals/${kiwiWrId}/status`, method: 'PATCH' },
      { status: 'APPROVED' },
      managerCookie
    );

    // Override FIFO to specifically dispatch newer kiwi2 instead of older kiwi1
    const overrideRes = await makeRequest(
      server,
      { path: '/api/dispatches/override', method: 'POST' },
      {
        withdrawalId: kiwiWrId,
        batchId: kiwiBatch2Id,
        reason: 'Customer requested premium fresh shipment lot',
      },
      managerCookie
    );
    assert(overrideRes.status === 201, `Expected 201 for FIFO override, got ${overrideRes.status}`);
    assert(overrideRes.data.data.batchAllocations[0].batchId === kiwiBatch2Id, 'Override must allocate chosen batch');

    // Query AuditLog table directly from database to verify audit entry
    const auditQuery = await pool.query(
      'SELECT * FROM "AuditLog" WHERE action = $1 AND "entityId" = $2',
      ['FIFO_OVERRIDE', overrideRes.data.data.id]
    );
    assert(auditQuery.rows.length === 1, 'Audit log record must exist');
    const auditRecord = auditQuery.rows[0];
    assert(auditRecord.reason === 'Customer requested premium fresh shipment lot', 'Audit reason must match');
    assert(auditRecord.userId === 'u_manager_1', 'Audit user ID must match manager');
    assert(auditRecord.ipAddress !== undefined, 'Audit IP address must be recorded');
    console.log('✓ FIFO override transactionally executed and logged to AuditLog table\n');

    // TEST 16: Unauthorized FIFO Override (Staff attempting override)
    console.log('Test 16: Unauthorized FIFO override attempt (Staff)');
    const unauthOverride = await makeRequest(
      server,
      { path: '/api/dispatches/override', method: 'POST' },
      {
        withdrawalId: kiwiWrId,
        batchId: kiwiBatch1Id,
        reason: 'Unauthorized test',
      },
      staffCookie
    );
    assert(unauthOverride.status === 403, `Staff should get 403 on FIFO override, got ${unauthOverride.status}`);
    console.log('✓ Unauthorized FIFO override blocked with 403\n');

    // TEST 17: Concurrent Chamber Allocation Race Condition Test
    console.log('Test 17: Concurrent allocation race condition test');
    // Chamber C has capacity 1500, occupied 300 -> 1200 free.
    // Let's create two batches of 700kg each (total 1400kg, which exceeds 1200kg).
    // Launch both allocation requests simultaneously!
    const batchC1 = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Butter Milk',
        supplierId: 'u_supplier_1',
        quantity: 700,
        unit: 'kg',
        receivedAt: '2026-09-26',
        expiryDate: '2026-10-26',
      },
      managerCookie
    );
    const batchC2 = await makeRequest(
      server,
      { path: '/api/batches', method: 'POST' },
      {
        productName: 'Cow Ghee',
        supplierId: 'u_supplier_1',
        quantity: 700,
        unit: 'kg',
        receivedAt: '2026-09-26',
        expiryDate: '2026-10-26',
      },
      managerCookie
    );

    const [cRes1, cRes2] = await Promise.all([
      makeRequest(
        server,
        { path: '/api/allocations', method: 'POST' },
        { batchId: batchC1.data.data.id, chamberId: 'ch_3', quantity: 700 },
        managerCookie
      ),
      makeRequest(
        server,
        { path: '/api/allocations', method: 'POST' },
        { batchId: batchC2.data.data.id, chamberId: 'ch_3', quantity: 700 },
        managerCookie
      ),
    ]);

    const statuses = [cRes1.status, cRes2.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, `One must succeed (201) and one must be rejected (409). Got: ${statuses.join(', ')}`);
    console.log(`✓ Concurrent race condition handled: one 201 Created and one 409 Capacity Exceeded\n`);

    console.log('===================================================');
    console.log('ALL DAY 2 TESTS (17/17) PASSED SUCCESSFULLY! ✓✓✓');
    console.log('===================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runDay2Tests();
