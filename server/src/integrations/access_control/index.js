'use strict';

const zkteco = require('./zktecoParser');
const hikvision = require('./hikvisionParser');
const antiPassback = require('./antiPassbackEngine');
const turnstiles = require('./turnstileManager');

module.exports = {
  ...zkteco,
  ...hikvision,
  ...antiPassback,
  ...turnstiles,
};
