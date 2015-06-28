var rainbowPixels = require('rainbow-pixels')
var pixelsToOpc = require('ndpixels-opc')
var net = require('net')
var through = require('through2')
var throttle = require('floodgate')

play({
  shape: [16, 16],
  fps: 120,
  inc: 1
})

function play (opts) {
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
    shape: opts.shape,
    inc: opts.inc
  })
  .pipe(throttle({
    objectMode: true,
    interval: 1000 / opts.fps
  }))
  .pipe(pixelsToOpc())
  .pipe(socket)
}
