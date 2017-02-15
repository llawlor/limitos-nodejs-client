// set up the websocket object
const WebSocket = require('ws');

// variable for the websocket, with the websocket server URL
const ws = new WebSocket('ws://192.168.0.100:3000/cable');
 
// create the channel JSON
var channel_json = JSON.stringify({channel: 'DevicesChannel'});

// when the websocket client connects to the server
ws.on('open', function() {
  // create the device subscription
  var device_subscription = {
    command: 'subscribe',
    identifier: channel_json
  };

  // send the subscription command
  ws.send(JSON.stringify(device_subscription));
});
 
// when the websocket receives a message
ws.on('message', function(data, flags) {
  // get the JSON data
  var json_data = JSON.parse(data);
 
  // if this is a ping command
  if (json_data.type === 'ping') {
    // log the ping message
    //console.log('ping: ' + json_data.message);
  // else if this is a subscription confirmation
  } else if (json_data.type === 'confirm_subscription') {
    console.log('subscribed to: ' + json_data.identifier);
  // else if this is a device message, handle it
  } else if (json_data.identifier === channel_json) {
    handleDeviceMessage(json_data.message);
  // else log the full message
  } else {
    console.log('message received: ' + data);
  }

});

// handle a device message
function handleDeviceMessage(message) {
  if (message.my_message === 'on') {
    console.log('on');
  } else if (message.my_message === 'off') {
    console.log('off');
  }
}
