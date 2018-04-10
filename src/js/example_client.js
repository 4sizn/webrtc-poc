/*
* semi main in development
*/

import $ from 'jquery'
import './../css/app.css'
import nanoid from 'nanoid'

console.log('Loaded PT_RTC')
var apiHost = (!location.href.match(/172.25|localhost/)) ? '/' : '//st.mobizen.com/'
if (['console'] === undefined || console.log === undefined) { console = {log: function () {}, info: function () {}, warn: function () {}, error: function () {}} } else if (!location.href.match(/172.25|localhost|st.mobizen.com/)) { console.log = console.info = console.warn = console.error = function () {} }

// Cross browsing
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.MediaDevices.getUserMedia
var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription
var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate

var signalServer = {}
var rtcconfig = {}

var receiverGuid = ''
var connectGuid = ''
var authcode = ''

var $ptmode = $('#ptmode')
var $authcode = $('#authCode')
var $btnRefresh = $('#btnRefresh')
var $ptRoom = $('#ptRoom')

var pc = null
var client = null
var localstream = null
var localsdp = null

var peerConnectionOptions = {
  'optional': [{
    'DtlsSrtpKeyAgreement': 'true'
  }]
}

var mediaConstraints = {
  'offerToReceiveAudio': true,
  'offerToReceiveVideo': true
}

var $btnRefresh = $('#btnRefresh')

$btnRefresh.on('click', function () {
  // disconnect_mqtt_rtc
  createAuthcode(nanoid(11))
})

init()

function init () {
  console.log('init', arguments)
  createAuthcode(nanoid(11))
}

function createAuthcode (guid) {
  console.log('createAuthcode', arguments)

  post('receiver/pt_authcode', {receiverguid: guid}).done(function (res) {
    console.log('pt_authcode', res)

    if (res.retcode !== '200') {
      console.log(res.message)
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

    // relay server connection
    // self.clientConnect();
  })
}

function post (url, params, success) {
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
};
