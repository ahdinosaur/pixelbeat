var mic = require('microphone')
var through = require('through2')
var rangeFit = require('range-fit')
var Cbuffer = require('CBuffer')
var frequencyWorker = require('frequency-viewer').worker
var deltaTimer = require('delta-timer')
var beatDetector = require('beats')
var range = require('lodash.range')

var byteRate = 2
var numChannels = 1
var height = 8
var width = 8
var bufferSize = 4096

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
.pipe(through.obj(circularize(bufferSize)))
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
.pipe(through.obj(function (chunk, enc, cb) {
  this.push(JSON.stringify(chunk))
  cb()
}))
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

function circularize (length) {
  var cbuf = Cbuffer(length)
  return function (chunk, enc, cb) {
    cbuf.push.apply(cbuf, chunk)
    cb(null, cbuf.toArray())
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
    console.log(chunk.length, elap)
    cb(null, detect(data, elap))
  }
}
