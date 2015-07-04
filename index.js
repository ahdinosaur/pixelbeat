var rainbowPixels = require('rainbow-pixels')
var pixelsToOpc = require('ndpixels-opc')
var net = require('net')
var through = require('through2')
var throttle = require('floodgate')
var readAudio = require('read-audio')
var frameHop = require('frame-hop')
var audioRms = require('node-audio-rms')
var pixelsToTerminal = require('2dpixels-terminal')
var Ndarray = require('ndarray')
var zeros = require('zeros')
var rangeFit = require('range-fit')

play({
  //shape: [16, 16],
  shape: [process.stdout.rows, process.stdout.columns],
  fps: 60,
  inc: 1,
  value: 0.3
})

function play (opts) {
  /*
  var socket = net.connect({
    port: 7890,
//  host: '192.168.7.2'
    host: 'localhost'
  }, function () {
    console.log("connected to", 'tcp://' + socket.remoteAddress + ':' + socket.remotePort )
  })
  .on('error', function (err) {
    throw err
  })
  */

  var audio = readAudio({
    channels: 1
  })

  audio.stderr.pipe(process.stderr)

  audio
  .pipe(audioRms(opts))
  .pipe(through.obj(function (audio, enc, cb) {
    cb(null, audio.data)
  }))
  .pipe(frameHop({
    frameSize: 128,
    hopSize: 1
  }))
  .pipe(through.obj(function (data, enc, cb) {
    cb(null, Ndarray(data))
  }))
  .pipe(plotRms(opts))
  .pipe(overlayRainbow(opts))
  .pipe(pixelsToTerminal(opts))
  //.pipe(pixelsToOpc())
  //.pipe(socket)
}

function plotRms (opts) {
  return through.obj(function (rms, enc, cb) {
    var frame = zeros(opts.shape)
    var maxPoint= Math.max.apply(null, rms.data)
    var minPoint = Math.min.apply(null, rms.data)
    for (var x = 0; x < rms.shape[0]; x++) {
      var value = rangeFit(rms.get(x), minPoint, maxPoint, 0.0, 1.0)
      var height = Math.ceil(value * opts.shape[1])
      for (var y = 0; y < height; y++) {
        frame.set(x, y, 1)
      }
    }
    //console.log("rms", frame)
    cb(null, frame)
  })
}

function overlayRainbow (opts) {
  var rainbow = rainbowPixels({
    shape: opts.shape,
    inc: opts.inc,
    value: opts.value
  })
  return through.obj(function (alpha, enc, cb) {
    var frame = rainbow.read()
    for (var x = 0; x < frame.shape[0]; x++) {
      for (var y = 0; y < frame.shape[1]; y++) {
        if (!alpha.get(x, y)) {
          frame.set(x, y, null)
        }
      }
    }
    //console.log("frame", frame.data)
    cb(null, frame)
  })
}

function getDecibels(value) {
  if (value == null) return 0
  return Math.round(Math.round(20 * (0.43429 * Math.log(value)) * 100) / 100 * 100) / 100
}
