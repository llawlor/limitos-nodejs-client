// this script must be run via sudo for the i2c communication to work
// example: sudo nodejs client.js

// set up the websocket object
const WebSocket = require('ws');
// set up the rpio object
var rpio = require('rpio');

// variable for the websocket, with the websocket server URL
//const ws = new WebSocket('wss://limitos.com/cable');
const ws = new WebSocket('ws://192.168.0.101:3000/cable');

// variable for the device ID
var device_id = 1;
 
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
var channel_json = JSON.stringify({channel: 'DevicesChannel', id: device_id});

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
  // calculate the delay
  var start_time = (new Date).getTime();
  var delay = start_time - message.time;
  var i2c_delay, log_message;

  // if there is a digital output command
  if (message.digital && message.digital.length !== 0) {
    // send the digital command
    rpio.i2cWrite(new Buffer("pin:" + message.pin + ",digital:" + message.digital));
    log_message = "digital_" + message.digital + ",pin_" + message.pin;
  // if there is a servo command
  } else if (message.servo && message.servo.length !== 0) {
    // send the servo command
    rpio.i2cWrite(new Buffer("pin:" + message.pin + ",servo:" + message.servo));
    log_message = "servo_" + message.servo + ",pin_" + message.pin;
  }

  // set the i2c delay
  i2c_delay = (new Date).getTime() - start_time;
  console.log(log_message + ', ws delay: ' + delay + 'ms, i2c delay: ' + i2c_delay + 'ms');

}
