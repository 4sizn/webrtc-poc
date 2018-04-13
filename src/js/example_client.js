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
  this._$ptmode = $('#ptmode')
  this._$authcode = $('#authCode')
  this._$btnRefresh = $('#btnRefresh')
  this._$ptRoom = $('#ptRoom')

  this._$languageList = $('#language-list')
  this._$selectLanguage = $('#select-language')

  this._$fullpageNav = $('#fullPage-nav')
  this._$main = $('main.content-wrap')
  this._$scrollBody = $('main.content-wrap')
  /***********************
       * initialize
       */
  this._setEvents()
  this.createAuthcode(nanoid(11))
}

PTMode.prototype._setEvents = function () {
  var self = this

  this._$btnRefresh.on('click', function () {
    self.ptDisconnect()
    self.createAuthcode(nanoid(11))
  })
  
  this._$ptRoom.find('button').on('click', function () {
    self._$btnRefresh.trigger('click')
  })
  // this._$languageButton.on('click', function (event) {
  //   console.log(event)
  //   console.log('languageButton')
  //   event.preventDefault()
  //   event.stopPropagation()
  //   var isVisible = this._$languageList.is(':visible')
  //   this._$languageList[isVisible ? 'hide' : 'show']()
  //   this._$languageButton[isVisible ? 'removeClass' : 'addClass']('open')
  // })


  // this._$selectLanguage.on('click', function (event) {
  //   console.log("asdfasdf")
  //   event.preventDefault()
  //   event.stopPropagation()
  // })
}

/***********************
   * Signaling
   */
PTMode.prototype.createAuthcode = function (_guid) {
  var self = this

  post('receiver/pt_authcode', {receiverguid: _guid}).done(function (res) {
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
  client = new Paho.MQTT.Client(signalServer.address, Number(signalServer.port), connectGuid)
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
      self._$btnRefresh.trigger('click')
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

  post('receiver/pt_standby', {
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

  post('receiver/pt_connect', {
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
  post('receiver/pt_close', {
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
  this._$ptRoom.hide()
  document.querySelector('video').srcObject = null
  this._$authcode.text(_code.slice(0, 3) + ' ' + _code.slice(3, 6))
}

PTMode.prototype.displayVideo = function (_show) {
  var self = this
  var video = document.querySelector('video')

  function setVideoSize () {
    video.style.width = '100%'
    video.style.height = '100%'
    self._$ptRoom.css('padding-top', (window.clientHeight - video.clientHeight) * 0.5 + 'px')
  }

  if (_show) {
    this._$ptRoom.show()
    video.srcObject = stream
    setVideoSize()
  } else {
    this._$ptRoom.hide()
    video.srcObject = null
  }
  $(window).on('resize', setVideoSize)
}

export default PTMode
