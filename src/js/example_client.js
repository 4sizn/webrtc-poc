/*
* semi main in development
*/
import $ from 'jquery'
import './../css/app.css'
import './../css/ptmode.css'
import nanoid from 'nanoid'
// import {hasWebrtc, getBrowser} from './caniuse'
import {connect} from 'rsup-mqtt'
import {post} from './restapi'

if (['console'] === undefined || console.log === undefined) { console = {log: function () {}, info: function () {}, warn: function () {}, error: function () {}} } else if (!location.href.match(/172.25|localhost|st.mobizen.com/)) { console.log = console.info = console.warn = console.error = function () {} }

function PTMode () {
  console.log('Loaded PT_RTC')

  var that = this
  // Cross browsing
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.MediaDevices.getUserMedia
  var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
  var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription
  var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate

  var peerConnectionOptions = {
    'optional': [{
      'DtlsSrtpKeyAgreement': 'true'
    }]
  }

  var mediaConstraints = {
    'offerToReceiveAudio': true,
    'offerToReceiveVideo': true
  }

  var signalServer = {}
  var rtcconfig = {}

  var receiverGuid = ''
  var connectGuid = ''
  var authcode = ''

  var client = null
  var subscription = null
  var $ptmode = $('#ptmode')
  var $authcode = $('#authCode')
  var $btnRefresh = $('#btnRefresh')
  var $ptRoom = $('#ptRoom')

  var pc = null
  var client = null
  var localstream = null
  var localSdp = null
  var $btnRefresh = $('#btnRefresh')

  $btnRefresh.on('click', function () {
  // disconnect_mqtt_rtc
    createAuthcode(nanoid(11))
  })

  $('#language-btn').on('click', function () {
    console.log('alert')
    this.prop('open', (this).is(':open') ? null:'open')
  })

  init()

  function init () {
    console.log('init', arguments)
    if (RTCPeerConnection === null) {
      console.alert('RTCPeerConnection not allow')
      return
    } else {
      console.log('Webrtc allow')
    }

    createAuthcode(nanoid(11))
  }

  function createAuthcode (guid) {
    console.log('createAuthcode', arguments)

    post('receiver/pt_authcode', {receiverguid: guid}).done(function (res) {
      console.log('pt_authcode', res)

      if (res.retcode !== '200') {
        console.log('error', res.message)
        return
      }
      // set datas
      sessionStorage.setItem('receiverguid', guid)
      receiverGuid = guid
      connectGuid = nanoid(11)
      signalServer = res.signal
      rtcconfig = res.rtcConfig
      authcode = res.authcode

      // UI - display authcode
      $authcode.text(authcode.slice(0, 3) + ' ' + authcode.slice(3, 6))

      // server connection
      clientConnect(res.signal)
    })
  }
  /*  connect mqtt & RTCPeerConnection
/* child mqttConnect, createPeerConnect
*/
  /*  disconnect mqtt & RTCPeerConnection
/* child mqttdisConnect, disconnectPeerConnect
*/
  function clientDisConnect () {
    console.log('clientDisConnect', arguments)
  }

  function clientConnect (signalServer) {
    console.log('clientConnect', arguments)
    // 만약 서브스크립션이 널널이거나 client 가 널이면?
    client == null && createMqttConnect(signalServer)
    createPeerConnection()
  }
  function createMqttConnect (signalServer) {
    console.log('mqttConnect', arguments, signalServer);

    (async () => {
      client = await connect({host: signalServer.address, port: signalServer.port, ssl: true})
      console.log('mqtt_test', client)
      // client.subscribe('MobizenPT/' + connectGuid)
      client.subscribe('MobizenPT/' + 'test')
        .on(onMqttMessageArrived)
        .publish('hello mqtt')

      client.on('message', (connectGuid, message) => {
        console.log('test topic :' + message.string)
        client.disconnect()
      })
    })()
  }

  var onMqttMessageArrived = function (message) {
    console.log('onMqttMessageArrived' + message)
  }

  function createPeerConnection () {
    console.log('createPeerConnection', arguments)
    console.log('rtcconfig', rtcconfig)
    pc = new RTCPeerConnection(rtcconfig, peerConnectionOptions)

    pc.createOffer(mediaConstraints).then(function (offer) {
      console.log('create offer: ' + offer)
      localSdp = offer
      console.log('locaSDP', localSdp)
    }).then(function () {
      // Send the offer to the remote peer using the signaling server
      console.log('set local des: ' + pc.localDescription.type)
      ptStandby()
    }).catch(function (err) {
      console.error('create offer err: ' + err)
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

      console.log('client . subscribe ', candidate, connectGuid)
      client.subscribe('MobizenPT/' + connectGuid).publish(JSON.stringify(candidate))
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
      localstream = event.streams[0]
      self.displayVideo(true)
    }
  }

  function ptStandby () {
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

  this.mute = function (callback) {
  }

  this.unmute = function (callback) {
  }
}

(function () {
  new PTMode()
})()
