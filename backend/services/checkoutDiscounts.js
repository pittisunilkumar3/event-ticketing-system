const coupons = require('./coupons');
const udyam = require('./udyam');

async function calculate(conn, input, items, options) {
  await udyam.checkAvailable(conn, input, items, options);
  return udyam.calculate(input, items, await udyam.publicConfig(input.event_id, conn)) || coupons.calculate(conn, input, items, options);
}

module.exports = {calculate};
