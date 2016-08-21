/* globals $, HipChat */
$(document).ready(function() {
  function startParty(emoticon, callback) {
    return HipChat.auth.withToken(function (err, token) {
      if (err) { return; }
      $.ajax({
        type: 'POST',
        url: '/start_party',
        headers: {'Authorization': 'JWT ' + token},
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({ emoticon: emoticon }),
        success: function () { callback(false); },
        error: function () { callback(true); }
      });
    });
  }
  HipChat.auth.withToken(function(err, token) {
    $.ajax({
      type: "GET",
      url: "/emoticons",
      headers: { 'authorization': 'JWT ' + token },
      dataType: 'json'
    }).then(function(emoticons) {
      var $container = $('#content');
      var $body = $('<dl>').attr('id', 'emoticonList');
      $.each(emoticons, function(idx, emoticon) {
        var $item = $('<dd>');
        $item.addClass('emoticon');
        $item.data('emoticon', emoticon);
        if (!emoticon.bpm) {
          $item.addClass('disabled');
        } else {
          $item.click(function() {
            $body.find('.emoticon').removeClass('selected');
            $item.addClass('selected');
            return false;
          });
        }
        $item.append($('<img>').attr('src', emoticon.url));
        $item.append($('<div>').text('(' + emoticon.shortcut + ')'));
        $body.append($item);
      });
      $container.empty().append($body);
    });
  });
  $('#toggle-disabled').click(function(e) {
    var $container = $('#content');
    $container.toggleClass('hide-disabled');
  });
  $('#refresh').click(function(e) {
    e.preventDefault();
    window.location.reload();
  });
  HipChat.register({
    "dialog-button-click": function (event, closeDialog) {
      if (event.action === "dialog.dance_party.action") {
        var emoticon = $('#content .selected').data('emoticon');
        if (!emoticon) {
          alert('Nothing selected');
          return;
        }

        startParty(emoticon, function (error) {
          if (!error)
            closeDialog(true);
          else
            console.log('Could not send message');
        });
      } else {
        //Otherwise, close the dialog
        closeDialog(true);
      }
    }
  });
});
