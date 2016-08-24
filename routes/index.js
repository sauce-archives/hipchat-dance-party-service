var uuid = require('uuid');
var url = require('url');
var router = require('express-promise-router')();
var SongFinder = require("bpm2spotify").default;
var SpotifyWebApi = require('spotify-web-api-node');
require('string.prototype.repeat');

const DANCE_LINE_LENGTH = 15;

const songfinder = new SongFinder();
const spotifyApi = new SpotifyWebApi();

module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);
  app.use('/', router);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  app.get('/gavin', function(req, res) {
    res.render('dialog');
  });

  app.get('/', function (req, res) {
    var homepage = url.parse(addon.descriptor.links.homepage);
    if (homepage.hostname === req.hostname && homepage.path === req.path) {
      res.render('homepage', addon.descriptor);
    } else {
      res.redirect(addon.descriptor.links.homepage);
    }
  });

  app.get('/dialog', addon.authenticate(), function (req, res) {
    res.render('dialog', {
      identity: req.identity
    });
  });

  function sendEmoticon(clientInfo, identity, from, emoticon) {
    return hipchat.sendMessage(
      clientInfo,
      identity.roomId,
      `(${emoticon.shortcut})`.repeat(DANCE_LINE_LENGTH),
      { message_format: 'text', from: from }
    ).then(response => {
      const messageId = response.headers.location.split('/').pop();
      return messageId;
    });
  }

  function sendTrack(clientInfo, identity, from, messageId, track) {
    const message = `<a href="${track.external_urls.spotify}">${track.artists[0].name} - ${track.album.name} - ${track.name}</a>`;
    var card = {
      style: 'application',
      url: track.preview_url + '?filename=preview.mp3',
      id: uuid.v4(),
      title: track.name,
      description: {
        format: 'html',
        value: message
      },
      format: 'medium',
      thumbnail: track.album.images[0],
      attributes: [
        {
          label: 'link',
          value: {
            url: track.external_urls.spotify,
            label: 'spotify',
            icon: {
              url: `${addon.config.localBaseUrl()}/img/Google-Chrome-icon.png`
            }
          },
        },
        {
          label: 'link',
          value: {
            url: track.preview_url + '?filename=preview.mp3',
            label: 'mp3',
            icon: {
              url: `${addon.config.localBaseUrl()}/img/Mp3-File-icon.png`
            }
          },
        }
      ]
      //icon: { 'url': emoticon.url },
    };
    return hipchat.sendMessage(
      clientInfo,
      identity.roomId,
      message,
      { message_format: 'html', attach_to: messageId, card: card, from: from }
    ).then(response => {
      const messageId = response.headers.location.split('/').pop();
      return messageId;
    });
  }
  app.post('/start_party', addon.authenticate(), function (req, res) {
    const emoticon = req.body.emoticon;
    const from = req.body.from;

    return songfinder.getRandomSong(123)
    .then(song => {
      const trackId = song.spotifyUrl.split('/').pop();
      return spotifyApi.getTrack(trackId)
      .then(track => track.body)
      .then(track => {
        sendEmoticon(req.clientInfo, req.identity, from, emoticon)
        .then(messageId => {
          setTimeout(() => sendTrack(req.clientInfo, req.identity, from, messageId, track), 50);
          setTimeout(() => sendEmoticon(req.clientInfo, req.identity, from, emoticon), 100);
        });
      });
    })
    .then(() => res.json({ status: "ok" }))
    .catch(err => {
      console.log('err', err);
      const msg = `Oops. Something crashed, couldn't dance /o\ \n Error was: ${err.message || err}`
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg);
      res.status(500).send({ status: "error", message: msg });
    });
  });

  const getClientEmoticonsSettings = (clientInfo) => {
    return addon.settings.get('emoticons', clientInfo.clientKey).then(emoticons => {
      return Object.assign({
        'partyparrot': { bpm: 149 },
        'nyancat': { bpm: 145 },
        'wizard': { bpm: 106 },
        'sharkdance': { bpm: 123 },
        'mario': { bpm: 123 },
        'megaman': { bpm: 150 },
        'boom': { bpm: 111 },
        'whynotboth': { bpm: 111 },
        'disappear': { bpm: 111 }
      }, emoticons || {});
    });
  }

  app.get('/emoticons', addon.authenticate(), function (req, res) {
    return Promise.all([
      hipchat.getEmoticons(req.clientInfo),
      getClientEmoticonsSettings(req.clientInfo)
    ]).then(values => {
      const [allEmoticons, savedEmoticons] = values;
      allEmoticons.body.items.forEach(emoji => {
        if (savedEmoticons[emoji.shortcut]) {
          emoji.bpm = savedEmoticons[emoji.shortcut].bpm;
        }
      });
      return res.json(allEmoticons.body.items)
    }).catch(err => {
      console.trace('Error handling emoticons', err);
      res.status(500).send(err);
    });
  });

  app.post('/emoticons', addon.authenticate(), function (req, res) {
    const emoticons = req.body.emoticons.filter(e=>e.bpm).reduce((emoticons, e) => {
      emoticons[e.shortcut] = { bpm: e.bpm };
      return emoticons;
    }, {});
    return addon.settings.set('emoticons', emoticons, req.clientInfo.clientKey)
      .then(() => res.json({}));
  });

  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });
};
