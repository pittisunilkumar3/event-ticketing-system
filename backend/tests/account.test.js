const test = require('node:test');
const assert = require('node:assert/strict');
const Admin = require('../models/Admin');
const { updateProfile, me } = require('../controllers/authController');

function call(handler, body) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { resolve({ status: this.statusCode, ...value }); } };
    handler({ body, admin: { id: 1 } }, res, reject);
  });
}

test('profile rejects malformed input before changing account data', async t => {
  const update = t.mock.method(Admin, 'updateProfile', async () => { throw new Error('Must not update invalid input'); });
  for (const body of [{ name: '  ', email: 'a@example.test' }, { name: 'A', email: 'invalid' }, { name: 'x'.repeat(101), email: 'a@example.test' }, { name: {}, email: 'a@example.test' }, { name: 'A', email: [] }]) {
    assert.equal((await call(updateProfile, body)).status, 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

test('profile normalizes values and never accepts a role from the form', async t => {
  t.mock.method(Admin, 'findByEmail', async () => null);
  const update = t.mock.method(Admin, 'updateProfile', async (id, profile) => ({ id, ...profile, role: 'staff', created_at: '2026-01-01', updated_at: '2026-10-13' }));
  const result = await call(updateProfile, { name: '  Alex Morgan  ', email: ' ALEX@EXAMPLE.TEST ', role: 'super_admin' });
  assert.equal(result.status, 200);
  assert.deepEqual(update.mock.calls[0].arguments, [1, { name: 'Alex Morgan', email: 'alex@example.test' }]);
  assert.equal(result.data.admin.role, 'staff');
});

test('duplicate profile email is rejected without overwriting either account', async t => {
  t.mock.method(Admin, 'findByEmail', async () => ({ id: 2 }));
  const update = t.mock.method(Admin, 'updateProfile', async () => {});
  assert.equal((await call(updateProfile, { name: 'Alex', email: 'other@example.test' })).status, 409);
  assert.equal(update.mock.callCount(), 0);
});

test('account details are returned from the saved record', async t => {
  const saved = { id: 1, name: 'Alex', email: 'alex@example.test', role: 'staff', created_at: '2026-01-01', updated_at: '2026-10-13' };
  t.mock.method(Admin, 'findById', async () => saved);
  assert.deepEqual((await call(me)).data.admin, saved);
});

test.after(() => require('../config/db').end());
