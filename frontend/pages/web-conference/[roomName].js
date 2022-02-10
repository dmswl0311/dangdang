import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import CameraSelect from "../../components/webRTC/devices/CameraSelect";
import MicSelect from "../../components/webRTC/devices/MicSelect";
import getVideoConstraints from "../../components/webRTC/getVideoConstraints";
import styles from "../../scss/web-conference/mainComponent.module.scss";
import SockJS from "sockjs-client";
import { WEBRTC_URL } from "../../config";

function mapStateToProps(state) {
  return {
    ws: state.wsReducer.ws,
    myIdName: `${state.userReducer.user.id}-${state.userReducer.user.nickName}`, // id + - + nickName
    cameraId: state.videoReducer.cameraId,
    micId: state.videoReducer.micId,
  };
}
export default connect(mapStateToProps, null)(Conference);
function Conference({ws, myIdName, cameraId, micId}) {
  const [me, setMe] = useState(null)
  const [mode, setMode] = useState(false) // 면접모드 true, 일반모드 false
  const [screenMode, setScreenMode] = useState(false)
  const chatInput = useRef();
  const chatInputBtn = useRef();
  const chatContentBox = useRef();
  const screenBox = useRef();
  const cameraBtn = useRef();
  const micBtn = useRef();
  const speakerBtn = useRef();
  const screenBtn = useRef();
  const interviewModeBtn = useRef();
  const normalModeBtn = useRef();
  const exitBtn = useRef();
  const router = useRouter();

  useEffect(() => {
    const roomName = router.query.roomName
    const myName = myIdName.slice(1 + myIdName.search('-'), myIdName.length);
    let meState = null
    // 새로고침 로직 다른거 생각중
    if(!ws) window.close();
    let participants = {};

    function Participant(IdName, isCam) {
      let rtcPeer;
      const idx = IdName.search('-')
      this.id = IdName.slice(0, idx)
      this.name = IdName.slice(1 + idx, IdName.length);

      const container = document.createElement('span');
      container.id = IdName;
      const span = document.createElement('span');
      span.innerText = this.name
      const video = document.createElement('video');
      video.id = 'video-' + IdName;
      video.autoplay = true;
      video.controls = false;
      container.appendChild(video);
      container.appendChild(span);
      container.style = "display: flex; flex-direction: column; align-items: center;"
      // if(this.id) {
      //   document.getElementById('participants').appendChild(container);
      // }else {
      //   // const screen = document.createElement("video")
      //   // screen.autoplay = true
      //   // screen.srcObject = stream
      //   screenBox.current.appendChild(video);
      //   video.style.height = "100%"
      //   video.style.width = "100%"
      //   setScreenMode(true);
      // }
      if(!isCam) {
        // pass
      }else if(this.id === "screen") {
        document.getElementById('screens').appendChild(container);
      }else {
        document.getElementById('participants').appendChild(container);
      }
    
      this.getElement = function() {
        return container;
      }
      this.getVideoElement = function() {
        return video;
      }
      if(isCam) {
        this.offerToReceiveVideo = function(error, offerSdp, wp){
          if (error) return console.log(`ERROR! ${error}`)
          sendMessage({ 
            id : "receiveVideoFrom",
            sender : IdName,
            sdpOffer : offerSdp
          });
        }
      }else {
        this.offerToReceiveVideo = function(error, offerSdp, wp){
          if (error) return console.log(`ERROR! ${error}`)
          screenMessage({ 
            id : "receiveVideoFrom",
            sender : IdName,
            sdpOffer : offerSdp
          });
        }
      }
      if(isCam) {
        this.onIceCandidate = function (candidate, wp) {
          sendMessage({
            id: 'onIceCandidate',
            candidate: candidate,
            name: IdName
          });
        }
      }else {
        this.onIceCandidate = function (candidate, wp) {
          screenMessage({
            id: 'onIceCandidate',
            candidate: candidate,
            name: IdName
          });
        }
      }
      this.dispose = function() {
        this.rtcPeer.dispose();
        container.parentNode.removeChild(container);
      };

      Object.defineProperty(this, 'rtcPeer', { writable: true});
    }
    function sendMessage(message) {
      const jsonMessage = JSON.stringify(message);
      // console.log("Sending message: " + jsonMessage);
      ws.send(jsonMessage);
    }
    ws.onmessage = function(message) {
      const jsonMsg = JSON.parse(message.data);
      // console.log("Received message: " + message.data);
      switch (jsonMsg.id) {
        case "existingParticipants":
          onExistingParticipants(jsonMsg);
          break;
        case "newParticipantArrived":
          onNewParticipant(jsonMsg);
          break;
        case "participantLeft":
          onParticipantLeft(jsonMsg);
          break;
        case "receiveVideoAnswer":
          receiveVideoResponse(jsonMsg);
          break;
        case "iceCandidate":
          participants[jsonMsg.name].rtcPeer.addIceCandidate(jsonMsg.candidate, function (error) {
            if (error) return console.log(`ERROR! ${error}`);
          });
          break;
        case "chat":
          onReceiveChat(jsonMsg);
          break;
        default:
          console.log(`ERROR! ${jsonMsg}`)
      }
    }

    function onNewParticipant(jsonMsg) {
      receiveVideo(jsonMsg.name);
    }
    function receiveVideoResponse(jsonMsg) {
      participants[jsonMsg.name].rtcPeer.processAnswer(jsonMsg.sdpAnswer, function(error) {
        if(error) return console.log(`ERROR! ${error}`);
      });
    }
    function onExistingParticipants(jsonMsg) {
      const participant = new Participant(myIdName, true);
      participants[myIdName] = participant;
      
      const options = {
        localVideo: participant.getVideoElement(),
        mediaConstraints: getVideoConstraints(480, 270),
        onicecandidate: participant.onIceCandidate.bind(participant)
      }
      participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
        if(error) return console.log(`ERROR! ${error}`);
        this.generateOffer(participant.offerToReceiveVideo.bind(participant));
      });
      jsonMsg.data.forEach(receiveVideo);
      meState = participant
      setMe(meState);
    }
    
    function receiveVideo(senderIdName) {
      // if(senderIdName === "-screen") return receiveScreen(senderIdName);
      const participant = new Participant(senderIdName, true);
      participants[senderIdName] = participant;

      const options = {
        remoteVideo: participant.getVideoElement(),
        onicecandidate: participant.onIceCandidate.bind(participant)
      }
    
      participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
        if(error) return console.log(`ERROR! ${error}`);
        this.generateOffer(participant.offerToReceiveVideo.bind(participant));
      });
    }

    function onParticipantLeft(jsonMsg) {
      const participant = participants[jsonMsg.name];
      participant.dispose();
      delete participants[jsonMsg.name];
    }

    const chatContentBoxEl = chatContentBox.current
    function onReceiveChat(jsonMsg) {
      const senderIdName = jsonMsg.sessionName
      const senderName = senderIdName.slice(1 + senderIdName.search('-'), senderIdName.length);
      const showingMsg = `${senderName}: ${jsonMsg.contents}`
      const showingMsgEl = document.createElement("h5")
      showingMsgEl.innerText = showingMsg
      chatContentBoxEl.appendChild(showingMsgEl)
    }

    function sendChatMsg() {
      const chatMsg = chatInputEl.value.trim()
      if(chatMsg) {
        sendMessage({
          id: "chat",
          contents: chatMsg
        })
      }
      chatInputEl.value = ""
    }
    const chatInputEl = chatInput.current
    const chatInputBtnEl = chatInputBtn.current
    chatInputBtnEl.addEventListener("click", sendChatMsg)

    const cameraBtnEl = cameraBtn.current
    const micBtnEl = micBtn.current
    const speakerBtnEl = speakerBtn.current
    const screenBtnEl = screenBtn.current
    const interviewModeBtnEl = interviewModeBtn.current
    const normalModeBtnEl = normalModeBtn.current
    const exitBtnEl = exitBtn.current
    function changeToInterviewMode() {
      setMode(true)
    }
    function changeToNomalMode() {
      setMode(false)
    }

    function ScreenHandler() {
      console.log('Loaded ScreenHandler', arguments);
      // REF https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints#Properties_of_shared_screen_tracks
      const constraints = {
        audio: true,
        video: {
            width: 800, // 최대 너비
            height: 450, // 최대 높이
            frameRate: 10, // 최대 프레임
        },
      };
      let localStream = null;
  
      // 스크린캡쳐 API를 브라우저 호환성 맞게 리턴합니다.
      function getCrossBrowserScreenCapture() {
        if (navigator.getDisplayMedia) {
            return navigator.getDisplayMedia(constraints);
        } else if (navigator.mediaDevices.getDisplayMedia) {
            return navigator.mediaDevices.getDisplayMedia(constraints);
        }
      }
  
      // 스크린캡쳐 API를 호출합니다.
      async function start() {
        try {
          localStream = await getCrossBrowserScreenCapture();
        } catch (err) {
          console.error('Error getDisplayMedia', err);
        }
        return localStream;
      }
  
      // 스트림의 트렉을 stop()시켜 스트림이 전송을 중지합니다.
      function end() {
        localStream.getTracks().forEach((track) => {
            track.stop();
        });
      }

      this.start = start;
      this.end = end;
    }

    function screenMessage(message) {
      const jsonMessage = JSON.stringify(message);
      console.log("Sending message: " + jsonMessage);
      screenWs.send(jsonMessage);
    }
    let screen;
    function existingScreens(jsonMsg) {
      screen = new Participant(`screen-${myIdName}`, false);
      console.log(stream)
      const options = {
        videoStream: stream,
        mediaConstraints: {
          audio: true,
          video: { mandatory: { maxWidth: 320, maxFrameRate: 15, minFrameRate: 15 } }
        },
        onicecandidate: screen.onIceCandidate.bind(screen),
      }
      // const options = {
      //   localVideo: screen.getVideoElement(),
      //   mediaConstraints: getVideoConstraints(480, 270),
      //   onicecandidate: screen.onIceCandidate.bind(screen)
      // }
      screen.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
        if(error) return console.log(`ERROR! ${error}`);
        this.generateOffer(screen.offerToReceiveVideo.bind(screen));
      });
    }

    let stream;
    let screenWs;
    async function startScreenShare() {
      if(!stream) {
        screenWs = new SockJS(`${WEBRTC_URL}/groupcall`);
        const screenHandler = new ScreenHandler();
        stream = await screenHandler.start();
        if(stream) {
          screenMessage({
            id: "joinRoom",
            name: `screen-${myIdName}`,
            room: roomName,
          });
          screenWs.onmessage = function(message) {
            const jsonMsg = JSON.parse(message.data);
            console.log("Received message: " + message.data);
            switch(jsonMsg.id) {
              case "existingParticipants":
                existingScreens(jsonMsg)
                break;
              case "newParticipantArrived":
                console.log(`111111 ${jsonMsg}`)
                break;
              case "participantLeft":
                console.log(`222222 ${jsonMsg}`)
                break;
              case "receiveVideoAnswer":
                screen.rtcPeer.processAnswer(jsonMsg.sdpAnswer, function(error) {
                  if(error) return console.log(`ERROR! ${error}`);
                });
                break;
              case "iceCandidate":
                screen.rtcPeer.addIceCandidate(jsonMsg.candidate, function (error) {
                  if (error) return console.log(`ERROR! ${error}`);
                });
                break;
              default:
                console.log(`ERROR! ${jsonMsg}`)
            }
          }
        }else {
          screenWs.close();
        }
      }else {
        stream = null;
        screenMessage({
          id: "leaveRoom"
        });
        screenWs.close();
      }
    }


    normalModeBtnEl.addEventListener("click", changeToNomalMode)
    interviewModeBtnEl.addEventListener("click", changeToInterviewMode)
    screenBtnEl.addEventListener("click", startScreenShare)
    // 방 입장
    sendMessage({
      id: "joinRoom",
      name: myIdName,
      room: roomName,
    });

    return () => {
      chatInputBtnEl.removeEventListener("click", sendChatMsg)
      normalModeBtnEl.removeEventListener("click", changeToNomalMode)
      interviewModeBtnEl.removeEventListener("click", changeToInterviewMode)
      screenBtnEl.removeEventListener("click", startScreenShare)
      // 방 퇴장
      sendMessage({
        id: "leaveRoom"
      });
      for (let key in participants) {
        participants[key].dispose();
      }
    }
  }, [])

  useEffect(async() => {
    if(me) {
      const newStream = await navigator.mediaDevices.getUserMedia(
        getVideoConstraints(480, 270)
      );
      const videoSender = me.rtcPeer.peerConnection.getSenders().find(sender => sender.track.kind === "video")
      const audioSender = me.rtcPeer.peerConnection.getSenders().find(sender => sender.track.kind === "audio")
      videoSender.replaceTrack(newStream.getVideoTracks()[0])
      audioSender.replaceTrack(newStream.getAudioTracks()[0])
      me.getVideoElement().srcObject = newStream
    }
  }, [cameraId, micId])

  return <div className={styles.mainContainer}>
    <div className={styles.videoContainer}>
      <div id="screens" ></div>
      <div ref={screenBox} style={!screenMode?{display: "none"}:{width: "60vw", height:"33.75vw"}}></div>
      <div className={styles.faces} id="participants"></div>
      <div className={styles.btnBar}>
        <span ref={cameraBtn}><i className="fas fa-video"></i></span>
        <span ref={micBtn}><i className="fas fa-microphone"></i></span>
        <span ref={speakerBtn}><i className="fas fa-volume-up"></i></span>
        <span ref={screenBtn}><i className="fas fa-tv"></i></span>
        <span ref={interviewModeBtn} style={mode?{display: "none"}:{}}><i className="fas fa-user-tie"></i></span>
        <span ref={normalModeBtn} style={!mode?{display: "none"}:{}}><i className="fas fa-users"></i></span>
        <span ref={exitBtn}><i className="fas fa-times-circle"></i></span>
      </div>
      <CameraSelect />
      <MicSelect />
    </div>
    <div className={styles.chat} id="chat">
      <h3>채팅창</h3>
      <div>
        <textarea ref={chatInput} />
        <button ref={chatInputBtn} >전송</button>
      </div>
      <div ref={chatContentBox}></div>
    </div>
  </div>
}