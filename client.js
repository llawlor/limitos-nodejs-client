// this script must be run via sudo for the i2c communication to work
// example: sudo nodejs limitos.js

// variable for the device ID
var device_id = 'DEVICE_ID';
// variable for the auth_token
var auth_token = 'AUTH_TOKEN';
// variable for the slave device information
var slave_devices = [];
// variable to keep track of whether slaves have been set up
var slave_devices_ready = false;
// time of last successful request for i2c data
var last_i2c_data_received = (new Date).getTime();

// set up the websocket object
const WebSocket = require('ws');
// set up the rpio object
var rpio = require('rpio');

// keep track of the last value; key is (i2c_address + '_' + pin_number)
// for example to access the value for i2c_address '0x04' and pin #8: last_values['0x04_8']
var last_values = [];

// variable for the websocket, with the websocket server URL
const ws = new WebSocket('wss://limitos.com/cable');

// enable i2c
rpio.init({gpiomem: false});

// use Broadcom GPIO pin naming
rpio.init({mapping: 'gpio'});

// create the channel JSON
var channel_json = JSON.stringify({
  channel: 'DevicesChannel',
  id: device_id,
  auth_token: auth_token
});

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
    // after subscription confirmation, send request for i2c addresses
    requestI2CAddresses();

  // else if this is a device message, handle it
  } else if (json_data.identifier === channel_json) {

    handleDeviceMessage(json_data.message);

  // else log the full message
  } else {

    console.log('message received: ' + data);

  }

});

// send a request to get the i2c slave addresses
function requestI2CAddresses() {
  // create the command to send
  var input = {
    command: 'message',
    identifier: channel_json,
    data: JSON.stringify({ action: 'request_slave_devices' })
  }
  // send the message
  ws.send(JSON.stringify(input));
}


// handle a device message
function handleDeviceMessage(message) {
  // if this is an i2c command
  if (message.i2c_address) {

    // send the command
    sendI2cCommand(message);

  // else if this is a message with the slave i2c addresses
  } else if (message.slave_devices) {

    // set the device information
    slave_devices = message.slave_devices;

    // for each address
    slave_devices.forEach(function(slave_device) {
      // send the setup command with the pin numbers
      sendI2cCommand(slave_device);

      // mark the slave devices as having been set up
      slave_devices_ready = true;
    });

  // else this is a direct message for the raspberry pi
  } else {

    // handle the direct message
    handleDirectMessage(message);

  }
}

// handle a direct message to the raspberry pi
function handleDirectMessage(message) {
  // initialize variables
  var pin_state;
  var pin_number = parseInt(message.pin);

  // if this is an on message
  if (message.digital === 'on') {
    pin_state = rpio.HIGH;
  // else if this is an off message
  } else if (message.digital === 'off') {
    pin_state = rpio.LOW;
  }

  // if this is a digital message
  if (message.digital && message.digital.length !== 0) {
    // output the message to the correct pin
    rpio.open(pin_number, rpio.OUTPUT, pin_state);
  }
}

// send an i2c command message to a connected slave device
function sendI2cCommand(message) {
  // calculate the delay
  var start_time = (new Date).getTime();
  var delay = start_time - message.time;
  var i2c_delay, log_message;

  // begin using i2c
  rpio.i2cBegin();
  // set i2c address (parsed in hex)
  rpio.i2cSetSlaveAddress(parseInt(message.i2c_address, 16));
  // set baudrate
  rpio.i2cSetBaudRate(30000);

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

  // if there is a pin setup command
  } else if (message.input_pins) {

    // send the setup command to the slave
    rpio.i2cWrite(new Buffer("setup_pins:" + message.input_pins));
    log_message = "setup_pins:" + message.input_pins;

  }

  // end i2c
  rpio.i2cEnd();

  // set the i2c delay
  i2c_delay = (new Date).getTime() - start_time;
  var websocket_delay_string = (message.time ? ', ws delay: ' + delay + 'ms' : '');
  console.log(log_message + websocket_delay_string + ', i2c delay: ' + i2c_delay + 'ms');
}

// request i2c data
function requestI2CData(i2c_address) {
  rpio.i2cBegin();
  rpio.i2cSetSlaveAddress(parseInt(i2c_address, 16));
  // set baudrate high for faster polling speed; don't set to 100000 or message corruption occurs
  rpio.i2cSetBaudRate(30000);
  // buffer with max message length of 64 characters
  var receive_buffer = new Buffer(64);
  rpio.i2cRead(receive_buffer);
  rpio.i2cEnd();
  // convert the buffer to a string
  var message = receive_buffer.toString();
  // remove extra data from the end of the string
  message = message.substring(0, message.indexOf(',end'));
  // console.log(message);

  // if there is a message, mark the time
  if (message.length > 0) { last_i2c_data_received = (new Date).getTime(); }

  // if the message is blank and we haven't received data for 5 seconds
  if (message.length === 0 && (last_i2c_data_received + 5000) < (new Date).getTime()) {

    // mark the time
    last_i2c_data_received = (new Date).getTime();

    // for each address
    slave_devices.forEach(function(slave_device) {
      // if the i2c addresses match
      if (i2c_address === slave_device.i2c_address) {
        // send the setup command with the pin numbers
        sendI2cCommand(slave_device);
      }
    });

  }

  // for each pin/value pair
  message.split(',').forEach(function(pin_value) {
    // get the pin number and value
    var pin_number = pin_value.split(':')[0];
    var value = pin_value.split(':')[1];

    // if the last value for this pin is different than the current value
    if (last_values[i2c_address + '_' + pin_number] !== value) {
      //console.log(value);
      // remember this value
      last_values[i2c_address + '_' + pin_number] = value;
      // send the websocket command
      sendWebsocketCommand(i2c_address, pin_number, value);
    }
  });
}

// send websocket command with the correct position
function sendWebsocketCommand(i2c_address, pin_number, position) {
  // exit if websocket isn't ready
  if (ws.readyState !== WebSocket.OPEN) { return }

  // create the command to send
  var input = {
    command: 'message',
    identifier: channel_json,
    data: JSON.stringify({
      i2c_address: i2c_address,
      pin: pin_number,
      servo: position
    })
  }

  // send the websocket input
  ws.send(JSON.stringify(input));
}

// continually request i2c data
setInterval(function() {
  // return if the slave devices are not ready
  if (slave_devices_ready === false) { return false; }

  // for each address
  slave_devices.forEach(function(slave_device) {
    // request the i2c data from the connected slave
    requestI2CData(slave_device.i2c_address);
  });
}, 5);
