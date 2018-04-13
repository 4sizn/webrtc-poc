/*
* semi main in development
*/
import $ from 'jquery'
import './../css/app.css'
import './../css/ptmode.css'
import nanoid from 'nanoid'
// import {hasWebrtc, getBrowser} from './caniuse'
// import {connect} from 'rsup-mqtt'
import './lib/mqttws31.min'
import {post} from './restapi'

'use strict'

var apiHost = (!location.href.match(/172.25|localhost/)) ? '/' : '//st.mobizen.com/'
if (['console'] === undefined || console.log === undefined) { console = {log: function () {}, info: function () {}, warn: function () {}, error: function () {}} } else if (!location.href.match(/172.25|localhost|st.mobizen.com/)) { console.log = console.info = console.warn = console.error = function () {} }

// browser compatibility
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia
var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription
var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate

var pc = null
var client = null
var localSdp = null
var stream = null

var receiverGuid = ''
var connectGuid = ''
var authcode = ''

var signalServer = {}
var rtcconfig = {}

var peerConnectionOptions = {
  'optional': [{
    'DtlsSrtpKeyAgreement': 'true'
  }]
}

var mediaConstraints = {
  'offerToReceiveAudio': true,
  'offerToReceiveVideo': true
}

function PTMode () {
  this.$ptmode = $('#ptmode')
  this.$authcode = $('#authCode')
  this.$btnRefresh = $('#btnRefresh')
  this.$ptRoom = $('#ptRoom')

  /***********************
       * initialize
       */

  this.createAuthcode(nanoid(11))

  var self = this
  this.$btnRefresh.on('click', function () {
    self.ptDisconnect()

    self.createAuthcode(nanoid(11))
  })
  this.$ptRoom.find('button').on('click', function () {
    self.$btnRefresh.trigger('click')
  })
}

PTMode.prototype.post = function (url, params, success) {
  var settings = {
    url: apiHost + url,
    type: 'POST',
    data: JSON.stringify(params),
    dataType: 'json',
    contentType: 'application/json; charset=utf-8'
  }
  if (success) {
    settings.success = success
  }
  return $.ajax(settings)
}

PTMode.prototype.get = function (url, params, success) {
  var settings = {
    url: apiHost + url,
    type: 'GET',
    data: params,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8'
  }
  if (success) {
    settings.success = success
  }
  return $.ajax(settings)
}

/***********************
   * Signaling
   */
PTMode.prototype.createAuthcode = function (_guid) {
  var self = this

  this.post('receiver/pt_authcode', {receiverguid: _guid}).done(function (res) {
    console.log('pt_authcode', res)

    if (res.retcode !== '200') {
      console.log(res.message)
      return
    }

    // UI - display authcode
    self.displayAuthcode(res.authcode)

    // set datas
    sessionStorage.setItem('receiverguid', _guid)
    receiverGuid = _guid
    connectGuid = nanoid(11)
    signalServer = res.signal
    rtcconfig = res.rtcConfig
    authcode = res.authcode

    // relay server connection
    self.clientConnect()
  })
}

PTMode.prototype.clientConnect = function () {
  console.log('clientConnect')

  var self = this
  client = new Paho.MQTT.Client(signalServer.address, Number(signalServer.port), connectGuid) // authcode로 바꾸자
  client.onMessageArrived = onMessageArrived
  client.onConnectionLost = onConnectionLost

  // connect the client
  client.connect({
    useSSL: true,
    mqttVersion: 3,
    onSuccess: onConnect,
    onFailure: onFailure
    // willMessage:willMessage
  })

  self.peerConnection()

  function onMessageArrived (message) {
    console.log('onMessageArrived:' + message.payloadString)

    var r = JSON.parse(message.payloadString)

    if (r.mptSessionDescription !== null && r.mptSessionDescription !== undefined) {
      console.log(r)
      if (r.mptEndpoint.endpointID === receiverGuid) return

      pc.setLocalDescription(localSdp)
      pc.setRemoteDescription(
        new RTCSessionDescription(r.mptSessionDescription),
        function () {
          console.log('publisher, Remote description accepted!')
        }
      ).then(function () {
        console.log('publisher, set RTC session description')

        // pt connect success
        self.ptConnect()
      }).catch(function (error) { console.error('publisher, set remote des err') })
    } else if (r.mptIceCandidate !== null && r.mptIceCandidate !== undefined) {
      if (r.mptEndpoint.endpointID === receiverGuid) return

      pc.addIceCandidate(new RTCIceCandidate(r.mptIceCandidate))
    }
  }

  function onConnectionLost (responseObject) {
    if (responseObject.errorCode !== 0) {
      console.error('onConnectionLost:' + responseObject.errorMessage)
      console.log(responseObject)
    }
    // relay server connection
    //  self.clientConnect();
    //  console.error("Client, Reconnecting");
    self.ptDisconnect()
  }

  function onConnect () {
    // Once a connection has been made, make a subscription and send a message.
    console.log('onConnect', connectGuid)
    client.subscribe('MobizenPT/' + connectGuid)
  }

  function onFailure () {
    console.log('onFailure')
  }

  function willMessage () {
    console.log('willMessage')
  }
}

PTMode.prototype.peerConnection = function () {
  var self = this

  pc = new RTCPeerConnection(rtcconfig, peerConnectionOptions)

  console.log('pc', pc)
  pc.createOffer(mediaConstraints).then(function (offer) {
    console.log('create offer: ' + offer)
    localSdp = offer
    console.log('locaSDP', localSdp)
  }).then(function () {
    // Send the offer to the remote peer using the signaling server
    console.log('set local des: ' + pc.localDescription.type)

    self.ptStandby()
  }).catch(function (error) {
    console.error('create offer err: ' + error)
  })

  pc.onicecandidate = function (event) {
    if (event.candidate === null) return

    console.log('onIce: ' + event.candidate.candidate)

    var candidate = {
      mptEndpoint: {
        endpointID: receiverGuid
      },
      mptIceCandidate: {
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        sdpMid: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      }
    }

    console.log(candidate, connectGuid)
    var message = new Paho.MQTT.Message(JSON.stringify(candidate))
    message.destinationName = 'MobizenPT/' + connectGuid
    client.send(message)
  }

  pc.oniceconnectionstatechange = function (event) {
    console.log('%coniceconnectionstatechange::' + pc.iceConnectionState, 'color:yellow')

    if (pc.iceConnectionState === 'failed' ||
              pc.iceConnectionState === 'disconnected' ||
              pc.iceConnectionState === 'close') {
      self.$btnRefresh.trigger('click')
    }
  }

  pc.ontrack = function (event) {
    console.log('ontrack')
    // open video ui
    stream = event.streams[0]
    self.displayVideo(true)
  }
}

PTMode.prototype.ptStandby = function () {
  console.log('ptStandby')

  this.post('receiver/pt_standby', {
    receiverguid: receiverGuid,
    authcode: authcode,
    connectguid: connectGuid,
    mptSessionDescription: {
      type: 'offer',
      sdp: localSdp.sdp
    }
  }).done(function (res) {
    if (res.retcode !== '200') {
      console.log(res.message)
    }
  })
}

PTMode.prototype.ptConnect = function () {
  console.log('ptConnect')

  this.post('receiver/pt_connect', {
    receiverguid: receiverGuid,
    connectguid: connectGuid
  }).done(function (res) {
    if (res.retcode !== '200') {
      console.log(res.message)
    }
  })
}

PTMode.prototype.ptDisconnect = function () {
  console.log('ptDisconnect')

  var self = this
  this.post('receiver/pt_close', {
    receiverguid: receiverGuid,
    connectguid: connectGuid
  }).done(function (res) {
    if (res.retcode !== '200') {
      console.log(res.message)
      return
    }

    sessionStorage.removeItem('receiverguid')
    pc.close()
    // close ptmode UI
    self.displayVideo(false)
  })
}

/***********************
   * UI
   */

PTMode.prototype.displayAuthcode = function (_code) {
  this.$ptRoom.hide()
  document.querySelector('video').srcObject = null
  this.$authcode.text(_code.slice(0, 3) + ' ' + _code.slice(3, 6))
}

PTMode.prototype.displayVideo = function (_show) {
  var self = this
  var video = document.querySelector('video')

  function setVideoSize () {
    video.style.width = '100%'
    video.style.height = '100%'
    self.$ptRoom.css('padding-top', (window.clientHeight - video.clientHeight) * 0.5 + 'px')
  }

  if (_show) {
    this.$ptRoom.show()
    video.srcObject = stream
    setVideoSize()
  } else {
    this.$ptRoom.hide()
    video.srcObject = null
  }
  $(window).on('resize', setVideoSize)
}

// exports.PTMode = PTMode

export default PTMode
