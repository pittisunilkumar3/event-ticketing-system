import assert from 'node:assert/strict';
import {checkoutDestination} from '../src/pages/checkoutNavigation.js';
const cart='1:2,3:3';
assert.equal(checkoutDestination({},'expo',cart),'/checkout/expo?tickets=1%3A2%2C3%3A3');
const destination=checkoutDestination({checkout_path:'/o/alpha/checkout/expo'},'expo',cart);
assert.equal(destination,'/o/alpha/checkout/expo?tickets=1%3A2%2C3%3A3');
assert.equal(new URL(destination,'https://ticket.example').searchParams.get('tickets'),cart);
assert.equal(checkoutDestination({checkout_path:'/o/bravo/checkout/expo'},'expo',cart),'/o/bravo/checkout/expo?tickets=1%3A2%2C3%3A3');
console.log('PASS platform and organizer checkout destinations preserve mixed-ticket quantities.');
