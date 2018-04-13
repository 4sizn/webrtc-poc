import './lib/mqttws31.min'
import nanoid from 'nanoid'

window.onload = function () {
  var apiHost = (!location.href.match(/172.25|localhost/)) ? '/' : '//st.mobizen.com/'

  var senderGuid = Math.round(Math.random() * 999999) + 999999
  var connectGuid
  var authCode
  var offerSdp
  var client
  var videolocal = document.getElementById('videolocal')
  var xhr = new XMLHttpRequest()
  var pc
  var pcConfig = {}

  var pcConstraints = {
    'optional': [{'DtlsSrtpKeyAgreement': true}]
  }

  $('button').on('click', init)

  function init () {
    navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
    console.log(navigator.mediaDevices)
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(getUserMediaSuccess).catch(function (error) {
          if (error) { console.log('%coniceconnectionstatechange::' + pc.iceConnectionState, 'color:yellow') }
        })
    } else {
      console.error('GetUserMedia not supported')
    };

    authCode = $('input[type=text]').val()

    xhr.open('POST', apiHost + '/sender/pt_join', true)
    xhr.setRequestHeader('Content-type', 'application/json')
    xhr.send(JSON.stringify({'senderguid': senderGuid, 'authcode': authCode}))

    xhr.onreadystatechange = function () {
      if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
        console.log(xhr.responseText)

        var r = JSON.parse(xhr.responseText)
        offerSdp = r.mptSessionDescription
        connectGuid = r.connectguid
        pcConfig = r.rtcConfig
        client = new Paho.MQTT.Client('stpush.startsupport.com', Number(4433), nanoid(11))

        // set callback handlers
        client.onConnectionLost = onConnectionLost
        client.onMessageArrived = onMessageArrived
      }
    }

    pc = new RTCPeerConnection(pcConfig, pcConstraints)

    pc.onicecandidate = function (event) {
      if (event.candidate === null) return

      console.log('onIce: ' + event.candidate.candidate)

      var candidate = JSON.stringify({
        'mptEndpoint': {
          'endpointID': senderGuid
        },
        'mptIceCandidate': {
          'sdpMLineIndex': event.candidate.sdpMLineIndex,
          'sdpMid': event.candidate.sdpMid,
          'candidate': event.candidate.candidate
        }
      })

      console.log(candidate)
      var message = new Paho.MQTT.Message(candidate)
      message.destinationName = 'MobizenPT/' + connectGuid
      client.send(message)
    }

    pc.ontrack = function (event) {
      console.log('onTrack: ' + event.streams[0])
      var videoremote = document.getElementById('videoremote')
      videoremote.srcObject = event.streams[0]
    }
  }

  function getUserMediaSuccess (stream) {
    console.log('getUserMedia Success')
    console.log('  -- Audio tracks:', stream.getAudioTracks())
    console.log('  -- Video tracks:', stream.getVideoTracks())

    videolocal.srcObject = stream

    if (pc !== null) {
      pc.addStream(stream)
    }

    // connect the client
    client.connect({useSSL: true, mqttVersion: 3, onSuccess: onConnect})
  }

  function createAnswerAndSend () {
    var mediaConstraints = {
      'mandatory': {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': false
      }
    }

    console.log('listener, set RTC session description')
    pc.createAnswer(function (answer) {
      pc.setLocalDescription(answer, function () {
        console.log('set local des: ' + pc.localDescription.type)

        var sdp = JSON.stringify({
          'mptEndpoint': {
            'endpointID': senderGuid
          },
          'mptSessionDescription': {
            'type': pc.localDescription.type,
            'sdp': pc.localDescription.sdp
          }
        })

        console.log(sdp)
        message = new Paho.MQTT.Message(sdp)
        message.destinationName = 'MobizenPT/' + connectGuid
        client.send(message)
      })
    }, function (error) {}, mediaConstraints)
  }

  // called when the client connects
  function onConnect () {
    console.log('onConnect')
    client.subscribe('MobizenPT/' + connectGuid)

    pc.setRemoteDescription(
      new RTCSessionDescription(offerSdp),
      function () {
        console.log('publisher, Remote description accepted!')
        createAnswerAndSend()
      }
    ).then(function () { console.log('publisher, set RTC session description') }
    ).catch(function (error) { console.error('publisher, set remote des err') })
  }

  // called when the client loses its connection
  function onConnectionLost (responseObject) {
    if (responseObject.errorCode !== 0) {
      console.log('onConnectionLost:' + responseObject.errorMessage)
    }
  }

  // called when a message arrives
  function onMessageArrived (message) {
    console.log('onMessageArrived:' + message.payloadString)

    var r = JSON.parse(message.payloadString)
    if (r.host !== null && r.host !== undefined) {

    } else if (r.mptSessionDescription !== null && r.mptSessionDescription !== undefined) {

    } else if (r.mptIceCandidate !== null && r.mptIceCandidate !== undefined) {
      if (r.mptEndpoint.endpointID === senderGuid) return
      pc.addIceCandidate(new RTCIceCandidate(r.mptIceCandidate))
    }
  }
}
