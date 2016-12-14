const ac = require('atlassian-connect-express');
const express = require('express');
ac.store.register('redis', require('atlassian-connect-express-redis'));

const app = express();
const addon = ac(app);

addon.settings.getAllClientInfos().then(clients => {
  console.log(clients);
});
