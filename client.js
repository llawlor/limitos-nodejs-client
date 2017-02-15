// set up the websocket object
const WebSocket = require('ws');

// variable for the websocket, with the websocket server URL
const ws = new WebSocket('ws://192.168.0.100:3000/cable');
 
// when the websocket client connects to the server
ws.on('open', function() {

  // create the channel JSON
  var channel_json = JSON.stringify({channel: 'DevicesChannel'});

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
  // debug: log the full message
  console.log('message received: ' + data);

  // get the JSON data
  var json_data = JSON.parse(data);
 
  // if this is a ping command
  if (json_data.type === 'ping') {
    // log the ping message
    console.log('ping: ' + json_data.message);
  }

});
