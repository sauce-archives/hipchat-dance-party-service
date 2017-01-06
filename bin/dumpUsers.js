const fs = require('fs');
const ac = require('atlassian-connect-express');
const express = require('express');
ac.store.register('redis', require('atlassian-connect-express-redis'));
ac.store.register('cloud_sql', require('../lib/store.js'));

const app = express();
app.set('env', 'production');
const addon = ac(app);
addon._configure = function() { }

addon.settings.getAllClientInfos().then(clientInfos => {
  return Promise.all(clientInfos.map(function(clientInfo) {
    return addon.settings.get('emoticons', clientInfo.clientKey).then(emoticons => {
      return {
        clientInfo: clientInfo,
        emoticons: emoticons
      };
    });
  }));
}).then(function(clients) {
  if (process.argv[2]) {
    fs.writeFileSync(
      process.argv[2],
      JSON.stringify(clients)
    );
  } else {
    console.log(JSON.stringify(clients));
  }
}).then(() => process.exit(0))
.catch(err => {
  console.error(err);
  process.exit(1);
});
