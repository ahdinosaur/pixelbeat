var mic = require('microphone')
var through = require('through2')
var rangeFit = require('range-fit')
var frequencyWorker = require('frequency-viewer').worker
var deltaTimer = require('delta-timer')
var beatDetector = require('beats')
var range = require('lodash.range')
var frameHop = require('frame-hop')
var arrayFrom = require('array-from')
var Ndarray = require('ndarray')
var showNdarray = require('ndarray-show')

var byteRate = 2
var numChannels = 1
var height = 8
var width = 8
var bufferSize = Math.pow(2, 8)

mic.startCapture({
  alsa_device: 'plughw:0,0',
  alsa_format: 'dat',
  alsa_addn_args: ['-t', 'raw'],
})
mic.infoStream.pipe(process.stderr)

mic.audioStream
.pipe(through.obj(function (buf, enc, cb) {
  var numSamples = buf.length / (byteRate * numChannels)

  var chunk = [[]]
  var sampleIndex, channelIndex, offset
  for (sampleIndex = 0; sampleIndex < numSamples; sampleIndex++) {
    for (channelIndex = 0; channelIndex < numChannels; channelIndex++) {
      offset = sampleIndex + channelIndex
      chunk[channelIndex][sampleIndex] = buf.readUIntLE(offset, byteRate)
    }
  }
  this.push(chunk)
  cb()
}))
.pipe(through.obj(function (chunk, enc, cb) {
  cb(null, chunk[0])
}))
.pipe(through.obj(fitWithinMag1()))
.pipe(through.obj(frame(bufferSize)))
.pipe(through.obj(getFrequencies()))
.pipe(through.obj(getBeats(
  range(width)
  .map(function (i) {
    return {
      lo: (i / width) * bufferSize,
      hi: ((i + 1) / width) * bufferSize - 1,
      threshold: 0,
      decay: 0.005
    }
  })
)))
.pipe(through.obj(visualizeBeats()))
.pipe(through.obj(showVisuals()))
.pipe(process.stdout)

function fitWithinMag1 () {
  return function (chunk, enc, cb) {
    var minUInt = 0
    var maxUInt = Math.pow(2, byteRate * 8) - 1
    cb(null, chunk.map(function (val) {
      return rangeFit(val, minUInt, maxUInt, -1.0, 1.0)
    }))
  }
}

function frame (frameSize) {
  var push = null
  var slicer = frameHop(frameSize, frameSize, function onFrame (frame) {
    push(frame)
  }.bind(this), Math.pow(frameSize, 2))
  
  return function (chunk, enc, cb) {
    push = this.push.bind(this)
    slicer(chunk)
    cb()
  }
}

function getFrequencies () {
  return function (chunk, enc, cb) {
    cb(null, frequencyWorker(chunk))
  }
}

function getBeats (bins) {
  var elapsed = deltaTimer()
  var detect = beatDetector(bins)
  return function (chunk, enc, cb) {
    var data = chunk.data
    var elap = elapsed()
    cb(null, detect(data, elap))
  }
}

function visualizeBeats () {
  return function (chunk, enc, cb) {
    var beats = arrayFrom(chunk)
    //var maxBeat = Math.max.apply(Math, beats) || 1
    var maxBeat = 255
    var arr = new Uint8Array(width * height)
    for (var i = 0; i < width * height; i++) {
      arr[i] = 0
    }
    var leds = Ndarray(arr, [ width, height ])
    beats.forEach(function (beat, i) {
      var beatHeight = Math.round((beat / maxBeat) * height)
      for (var y = 0; y < beatHeight; y++) {
        leds.set(i, y, 255)
      }
    })
    cb(null, leds)
  }
}

function showVisuals () {
  return function (chunk, enc, cb) {
    cb(null, showNdarray(chunk) + '\n\n')
  }
}
