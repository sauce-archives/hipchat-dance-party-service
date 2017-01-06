const fs = require('fs');
const ac = require('atlassian-connect-express');
const express = require('express');
ac.store.register('redis', require('atlassian-connect-express-redis'));
ac.store.register('cloud_sql', require('./lib/store.js'));

const app = express();
app.set('env', 'production');
const addon = ac(app);
addon._configure = function() { };

const users = JSON.parse(fs.readFileSync(process.argv[2] || './users.json'));
Promise.all(users.map(function(user) {
  return Promise.all([
    addon.settings.set('clientInfo', user.clientInfo, user.clientInfo.clientKey),
    addon.settings.set('emoticons', user.emoticons, user.clientInfo.clientKey)
  ]);
})).then(() => process.exit(1));
