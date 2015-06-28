var rainbowPixels = require('rainbow-pixels')
var pixelsToOpc = require('ndpixels-opc')
var net = require('net')
var through = require('through2')
var throttle = require('floodgate')

var socket = net.connect({
  port: 7890,
  host: '192.168.7.2'
//  host: 'localhost'
}, function () {
  console.log("connected to", 'tcp://' + socket.remoteAddress + ':' + socket.remotePort )
})
.on('error', function (err) {
  throw err
})

rainbowPixels({
  shape: [16, 16],
  inc: 1
})
.pipe(throttle({
  objectMode: true,
  interval: 25
}))
.pipe(pixelsToOpc())
.pipe(socket)
