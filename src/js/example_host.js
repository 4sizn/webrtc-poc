import $ from 'jquery'
import nanoid from 'nanoid'
import {post} from './restapi'

function PTHost () {
  var that = this
  var client = null
  var authcode = null
  var senderGuid = null
  var connectGuid = null
  var signalServer = null
  var pc = null

  $('button').on('click', start)

  function start () {
    console.log('button click')
    navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
    console.log(navigator.mediaDevices)
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(getUserMediaSuccess).catch(function (error) {
          if (error && pc) { console.log('%coniceconnectionstatechange::' + pc.iceConnectionState, 'color:yellow') }
        })
    } else {
      console.error('GetUserMedia not supported')
    };

    authcode = $('input[type=text]').val()
    senderGuid = nanoid(11)

    //WEBAPI JOIN
    post('/sender/pt_join', {'senderguid': senderGuid, 'authcode': authcode})
      .done(function (res) {
        console.log('POST : /sender/pt_join DONE', res)
        if (res.status === 200) {
          var r = JSON.parse(res)
          offerSdp = r.mptSessionDescription
          connectGuid = r.connectguid
          signalServer = r.signal
          pcConfig = r.rtcConfig
          that.clientConnect(signalServer)
          // client = new Paho.MQTT.Client('stpush.startsupport.com', Number(4433), 'host')
        }
      })
      .fail(function (err) {
        console.log('POST : /sender/pt_join fail', err)
      })

    function getUserMediaSuccess (stream) {
      console.log('getUserMedia Success')
      console.log('  -- Audio tracks:', stream.getAudioTracks())
      console.log('  -- Video tracks:', stream.getVideoTracks())

      videolocal.srcObject = stream

      if (pc !== null) {
        pc.addStream(stream)
      }

      // connect the client
      // client.connect({useSSL: true, mqttVersion: 3, onSuccess: onConnect})
    }

    function clientConnect (signalServer) {
      console.log('clientConnect', arguments)
      // 만약 서브스크립션이 널널이거나 client 가 널이면?
      client == null && createMqttConnect(signalServer)
      // createPeerConnection()
    }
    function createMqttConnect (signalServer) {
      console.log('mqttConnect', arguments, signalServer);

      (async () => {
        client = await connect({host: signalServer.address, port: signalServer.port, ssl: true})
        console.log(client)
        client.subscribe('MobizenPT/' + 'test')
          .on(onMqttMessageArrived)
          .publish('hello mqtt')
      })()
    }

    var onMqttMessageArrived = function (message) {
      console.log('onMqttMessageArrived' + message)
    }
  }
}

(function () {
  new PTHost()
})()
