// this script must be run via sudo for the i2c communication to work
// example: sudo nodejs client.js

// set up the websocket object
const WebSocket = require('ws');
// set up the rpio object
var rpio = require('rpio');

// variable for the websocket, with the websocket server URL
const ws = new WebSocket('ws://192.168.0.100:3000/cable');
 
// enable i2c
rpio.init({gpiomem: false});

// use Broadcom GPIO pin naming
rpio.init({mapping: 'gpio'});

// begin using i2c
rpio.i2cBegin();
// set i2c address to 0x04
rpio.i2cSetSlaveAddress(0x04);
// set baudrate
rpio.i2cSetBaudRate(9600);

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
  if (message.value === 'on') {
    console.log('on');
    // send message via i2c
    rpio.i2cWrite(new Buffer(message.value));
  } else if (message.value === 'off') {
    console.log('off');
    // send message via i2c
    rpio.i2cWrite(new Buffer(message.value));
  // if there is a servo command
  } else if (message.servo.length !== 0) {
    console.log(message);
    // send the servo command
    rpio.i2cWrite(new Buffer("servo_" + message.servo));
  }
}
