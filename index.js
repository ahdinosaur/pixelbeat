var mic = require('microphone')
var through = require('through2')
var frameHop = require('frame-hop')
var detectPitch = require('detect-pitch')
var arrayPool = require('typedarray-pool')

var sampleRateInHz = 44100
var byteRate = 4
var numChannels = 1
var readSample = function (buffer, offset) {
  return buffer.readFloatLE(offset)
}
var framer = function () {
  var push = null
  var slicer = frameHop(2048, 2048 >>> 2, function onFrame (frame) {
    push(frame)
  }.bind(this), sampleRateInHz)
  
  return through.obj(function (chunk, enc, cb) {
    push = this.push.bind(this)
    slicer(chunk[0])
    cb()
  })
}

mic.startCapture({
  alsa_device: 'plughw:0,0',
  alsa_format: 'FLOAT_LE',
  alsa_addn_args: ['-t', 'raw', '--rate', sampleRateInHz.toString()],
})
mic.infoStream.pipe(process.stderr)

mic.audioStream
.pipe(through.obj(function (buf, enc, cb) {
  var numSamples = buf.length / (byteRate * numChannels)

  var chunk = [new Float32Array(numSamples)]

  var sampleIndex, channelIndex, offset
  for (sampleIndex = 0; sampleIndex < numSamples; sampleIndex++) {
    for (channelIndex = 0; channelIndex < numChannels; channelIndex++) {
      offset = sampleIndex + channelIndex
      chunk[channelIndex][sampleIndex] = readSample(buf, offset)
    }
  }
  cb(null, chunk)
}))
.pipe(framer())
.pipe(through.obj(function (chunk, enc, cb) {
  var arr = new Float32Array(chunk)
  console.log("arr", arr)
  var periodInSamples = detectPitch(arr)
  console.log("periodInSamples", periodInSamples)
  var pitchInHz = sampleRateInHz / periodInSamples
  cb(null, pitchInHz)
}))
.pipe(through.obj(function (chunk, enc, cb) {
  cb(null, JSON.stringify(chunk))
}))
.pipe(process.stdout)
