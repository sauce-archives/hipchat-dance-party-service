/* global HipChat, $, AP */
'use strict';

const React  = require('react');
const ReactDOM = require('react-dom');
const promisify = require('es6-promisify-all');
const classNames = require('classnames');

import {throttle, assign} from 'lodash';
import {createStore} from 'redux';

var Rollbar = require('./rollbar.umd.nojson.min.js').init({
  accessToken: "13c076da4f88476f97047befd32696ca",
  captureUncaught: true,
  captureUnhandledRejections: false,
  payload: { environment: process.env.NODE_ENV }
});

require('es6-promise').polyfill();
require('isomorphic-fetch');

if (!window.HipChat) { window.HipChat = { auth: { withToken: () => {} }, register: () => {} }; }
if (HipChat.auth) {
  HipChat.auth = promisify(HipChat.auth);
}
if (HipChat.user) {
  HipChat.user = promisify(HipChat.user);
}

function emoticons(state = [], action) {
  switch (action.type) {
    case 'ADD':
      return state.concat(action.emoticon);
    case 'SET':
      return action.emoticons.map(emoticon => emoticon);
    case 'BPMIFY':
      return state.map(emoticon => {
        if (action.id === emoticon.id) {
          return assign({}, emoticon, { bpm: action.bpm });
        }
        return emoticon;
      });
    default:
      return state
  }
}

let store = createStore(emoticons)
HipChat.auth.withTokenAsync().then(token => {
  return fetch('/emoticons', {
    method: 'GET',
    headers: { 'Authorization': 'JWT ' + token },
  })
  .then(response => response.json())
  .then(emoticons => store.dispatch({ type: 'SET', emoticons: emoticons }) );
});

class PartyDialog extends React.Component {
  constructor() {
    super();
    this.state = { mode: 'party', emoticons: store.getState() };
    this.onClickEmoticon = this.onClickEmoticon.bind(this);
    this.onDialogClickStart = throttle(this.onDialogClickStart.bind(this), 1000);
    this.onDialogClickSave = throttle(this.onDialogClickSave.bind(this), 1000);
    this.startParty = this.startParty.bind(this);
    this.clickParty = this.clickNav.bind(this, 'party');
    this.clickConfig = this.clickNav.bind(this, 'config');
    this.setupDialog('party');
  }

  setupDialog(mode) {
    AP.require("dialog", function (dialog) {
      dialog.update({
        title: (mode === 'party' ? "Start a Dance Party!" : "Setup that Dance Party" ),
        options: {
          style: "normal",
          primaryAction: {
            name: (mode === 'party' ? 'Start' : 'Save'),
            key: (mode === 'party' ? "action.dance_party.start" : "action.dance_party.save"),
            enabled: true
          },
          size: "large"
        }
      })
    });
  }

  clickNav(mode) {
    this.setState({ mode: mode });
    this.setupDialog(mode);
  }

  startParty(emoticon) {
    return HipChat.user.getCurrentUserAsync().then(user => {
      return HipChat.auth.withTokenAsync().then(token => {
        return fetch('/start_party', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'JWT ' + token
          },
          body: JSON.stringify({ emoticon: emoticon, from: user.name }),
        }).then(response => response.json());
      });
    });
  }

  onDialogClickStart() {
    const emoticon = this.state.emoticons.find(e => e.selected);
    if (!emoticon) {
      alert('Nothing selected');
      return;
    }

    this.startParty(emoticon)
  }

  onDialogClickSave() {
    return HipChat.auth.withTokenAsync().then(token => {
      return fetch('/emoticons', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'JWT ' + token
        },
        body: JSON.stringify({ emoticons: this.state.emoticons.filter(e => e.bpm) }),
      }).then(response => response.json());
    });
  }


  componentDidMount() {
    HipChat.register({
      "dialog-button-click": (event, closeDialog) => {
        let promise;
        if (event.action === "action.dance_party.start") {
          promise =this.onDialogClickStart();
        } else if (event.action === "action.dance_party.save") {
          promise = this.onDialogClickSave();
        }

        if (promise) {
          promise
            .then(() => closeDialog(true))
            .catch(e => {
              alert('Try Again')
              Rollbar.error("Error", e);
            });
        } else {
          closeDialog(true);
        }
      }
    });
    store.subscribe(() => this.setState({ emoticons: store.getState() }));
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

    let body;
    if (this.state.mode == 'party') {
      body = this.state.emoticons
        .filter(emoticon => emoticon.bpm)
        .map(emoticon =>
             <Emoticon
               key={emoticon.shortcut}
               onClick={this.onClickEmoticon}
               emoticon={emoticon}
               selected={emoticon.selected || false}
             />);
    } else {
      body = this.state.emoticons
        .map(emoticon =>
             <EditEmoticon
               key={emoticon.shortcut}
               emoticon={emoticon}
             />);
    }

    return (
      <div>
        {/* Horizontal navigation tabs */}
        <nav className="aui-navgroup aui-navgroup-horizontal">
          <div className="aui-navgroup-inner">
            <div className="aui-navgroup-primary">
              <ul className="aui-nav">
                <li className={ this.state.mode === 'party' ? 'aui-nav-selected' : ''}><a onClick={this.clickParty} href="#"><h2>Party Time</h2></a></li>
                <li className={ this.state.mode === 'config' ? 'aui-nav-selected' : ''}><a onClick={this.clickConfig} href="#">Config</a></li>
              </ul>
            </div>
          </div>
        </nav>
        <section className="aui-connect-content with-list">
          <ol className="aui-connect-list">
            <dl id="emoticonList">{body}</dl>
          </ol>
        </section>
      </div>
    );
  }
}

class EditEmoticon extends React.Component {
  static propTypes = {
    emoticon: React.PropTypes.object.isRequired
  };

  constructor() {
    super();
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {
    store.dispatch({ type: 'BPMIFY', id: this.props.emoticon.id, bpm: event.target.value });
  }

  render() {
    const {emoticon} = this.props;

    return (
      <dd onClick={this.onClick} key={emoticon.shortcut} className="emoticon">
        <img src={emoticon.url} />
        <div>({emoticon.shortcut})</div>
        <div><input
          type="number"
          min="0" max="400" step="1"
          placeholder="BPM"
          defaultValue={this.props.emoticon.bpm}
          onChange={this.handleChange}
        /></div>
      </dd>
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
