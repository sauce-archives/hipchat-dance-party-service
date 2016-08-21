/* global HipChat, $, AP */
'use strict';

const React  = require('react');
const ReactDOM = require('react-dom');
const promisify = require('es6-promisify-all');
const classNames = require('classnames');

var Rollbar = require('./rollbar.umd.nojson.min.js').init({
  accessToken: "13c076da4f88476f97047befd32696ca",
  captureUncaught: true,
  captureUnhandledRejections: false,
  payload: { environment: process.env.NODE_ENV }
});

require('es6-promise').polyfill();
require('isomorphic-fetch');

if (!window.HipChat) { window.HipChat = { auth: { withToken: () => {} }, register: () => {} }; }
HipChat.auth = promisify(HipChat.auth);

class PartyDialog extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.startParty = this.startParty.bind(this);
    this.onClickEmoticon = this.onClickEmoticon.bind(this);
  }

  startParty(emoticon) {
    return HipChat.auth.withTokenAsync().then(token => {
      return fetch('/start_party', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'JWT ' + token
        },
        body: JSON.stringify({ emoticon: emoticon }),
      }).then(response => response.json());
    });
  }

  componentDidMount() {
    HipChat.register({
      "dialog-button-click": (event, closeDialog) => {
        console.log('event', event);
        if (event.action === "dialog.dance_party.action") {
          const emoticon = this.state.emoticons.find(e => e.selected);
          if (!emoticon) {
            alert('Nothing selected');
            return;
          }

          this.startParty(emoticon)
            .then(() => closeDialog(true))
            .catch(e => {
              alert('Error starting party')
              Rollbar.error("Error starting party", e);
            })
        } else {
          closeDialog(true);
        }
      }
    });

    HipChat.auth.withTokenAsync().then(token => {
      return fetch('/emoticons', {
        method: 'GET',
        headers: { 'Authorization': 'JWT ' + token },
      })
      .then(response => response.json())
      .then(emoticons => this.setState({ emoticons }) );
    });
  }

  onClickEmoticon(id) {
    this.setState({ emoticons: this.state.emoticons.map(emoticon => {
      if (emoticon.id === id) {
        emoticon.selected = true;
      } else {
        delete emoticon.selected;
      }
      return emoticon;
    }) });
  }

  render() {
    if (!this.state.emoticons) {
      return <div>Loading</div>;
    }

    return (
      <dl id="emoticonList">
      {
        this.state.emoticons.map(emoticon =>
                                <Emoticon 
                                  key={emoticon.shortcut} 
                                  onClick={this.onClickEmoticon}
                                  emoticon={emoticon} 
                                  selected={emoticon.selected || false}
                                />)
      }
      </dl>
    );
  }
}


class Emoticon extends React.Component {
  static propTypes = {
    onClick: React.PropTypes.func.isRequired,
    emoticon: React.PropTypes.object.isRequired,
    selected: React.PropTypes.bool.isRequired
  };

  constructor() {
    super()
    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    this.props.onClick(this.props.emoticon.id);
  }

  render() {
    const {emoticon, selected} = this.props;

    const classes = classNames('emoticon', {
      disabled: !emoticon.bpm,
      selected: selected
    })
    return (
      <dd onClick={this.onClick} key={emoticon.shortcut} className={classes}>
        <img src={emoticon.url} />
        <div>({emoticon.shortcut})</div>
      </dd>
    );
  }
}

/*
$('#toggle-disabled').click(function(e) {
  var $container = $('#content');
  $container.toggleClass('hide-disabled');
});
$('#refresh').click(function(e) {
  e.preventDefault();
  window.location.reload();
});
*/

const entryMap = {
  'party-dialog': PartyDialog
};

Object.keys(entryMap).forEach(id => {
  const elm = document.getElementById(id);
  if (!elm) { return; }

  const attrs = {};
  Object.keys(elm.dataset).forEach(key => {
    let attr = elm.dataset[key];
    try {
      attrs[key] = JSON.parse(attr);
    } catch (e) {
      attrs[key] = attr;
    }
  });

  ReactDOM.render(React.createElement(entryMap[id], attrs), elm);
});
