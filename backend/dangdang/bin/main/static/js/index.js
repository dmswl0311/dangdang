/*
 * (C) Copyright 2014-2016 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ws = new SockJS('https://' + location.host + '/recording');
var videoInput;
var videoOutput;
var webRtcPeer;
var state;

var rpath; //녹화 파일 이름
var saveName; //프론트로부터 받은 저장할 파일 이름

const NO_CALL = 0;
const IN_CALL = 1;
const POST_CALL = 2;
const DISABLED = 3;
const IN_PLAY = 4;

window.onload = function() {
	console = new Console();
	console.log('Page loaded ...');
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');
	setState(NO_CALL);
}

window.onbeforeunload = function() {
	var message = {
		'id' : 'del',
	}
	sendMessage(message);
	ws.close();
}

function setState(nextState) {
	switch (nextState) {
	case NO_CALL:
		$('#start').attr('disabled', false);
		$('#stop').attr('disabled', true);
		$('#play').attr('disabled', true);
		break;
	case DISABLED:
		$('#start').attr('disabled', true);
		$('#stop').attr('disabled', true);
		$('#play').attr('disabled', true);
		break;
	case IN_CALL:
		$('#start').attr('disabled', true);
		$('#stop').attr('disabled', false);
		$('#play').attr('disabled', true);
		break;
	case POST_CALL:
		$('#start').attr('disabled', false);
		$('#stop').attr('disabled', true);
		$('#play').attr('disabled', false);
		break;
	case IN_PLAY:
		$('#start').attr('disabled', true);
		$('#stop').attr('disabled', false);
		$('#play').attr('disabled', true);
		break;	
	default:
		onError('Unknown state ' + nextState);
	return;
	}
	state = nextState;
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'startResponse':
		startResponse(parsedMessage);
		break;
	case 'playResponse':
		playResponse(parsedMessage);
		break;
	case 'playEnd':
		playEnd();
		break;
	case 'error':
		setState(NO_CALL);
		onError('Error message from server: ' + parsedMessage.message);
		break;
	case 'iceCandidate':
		webRtcPeer.addIceCandidate(parsedMessage.candidate, function(error) {
			if (error)
				return console.error('Error adding candidate: ' + error);
		});
		break;
	case 'stopped':
		break;
	case 'paused':
		break;
	case 'recording':
		break;
	default:
		setState(NO_CALL);
	onError('Unrecognized message', parsedMessage);
	}
}


// 녹화 영상 보여줌
function playRecord(recordingpath){
	console.log("녹화 영상 버튼 클릭!");
	console.log("path :: ",recordingpath);
	rpath=recordingpath;
	play();
}

// 삭제
function del(){
	console.log("js del 확인!");
	var message = {
		'id' : 'del',
	}
	sendMessage(message);
}

function start(name) {
	console.log('Starting video call ...');
	console.log("받은 파일 name :: "+name);
	name = document.getElementById("fileName").value;
	saveName=name;
	// Disable start button
	setState(DISABLED);
	showSpinner(videoInput);
	console.log('Creating WebRtcPeer and generating local sdp offer ...');

	var options = {
			localVideo : videoInput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onOffer);
	});
	
}

function onOffer(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'start',
			sdpOffer : offerSdp,
			mode :  $('input[name="mode"]:checked').val(),
			name : saveName
	}
	sendMessage(message);
}

function onError(error) {
	console.error(error);
}

function onIceCandidate(candidate) {
	console.log('Local candidate' + JSON.stringify(candidate));

	var message = {
			id : 'onIceCandidate',
			candidate : candidate
	};
	sendMessage(message);
}

function startResponse(message) {
	setState(IN_CALL);
	console.log('SDP answer received from server. Processing ...');
	console.log("============================================")
	console.log(message)
	// 서버에서 세션ID 받아옴
	console.log(message.sessionId)
	console.log("============================================")
	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function stop() {
	var stopMessageId = (state == IN_CALL) ? 'stop' : 'stopPlay';
	console.log('Stopping video while in ' + state + '...');
	setState(POST_CALL);
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;

		var message = {
				id : stopMessageId
		}
		sendMessage(message);
	}
	hideSpinner(videoInput, videoOutput);
}

function play() {
	console.log("Starting to play recorded video...");

	// Disable start button
	setState(DISABLED);
	// 녹화된 영상을 보여줄 화면 videoOutput
	showSpinner(videoOutput);

	console.log('Creating WebRtcPeer and generating local sdp offer ...');

	var options = {
			remoteVideo : videoOutput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onPlayOffer);
	});
}

function onPlayOffer(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'play',
			sdpOffer : offerSdp,
			path : rpath
	}
	sendMessage(message);
}

function getConstraints() {
	var mode = $('input[name="mode"]:checked').val();
	var constraints = {
			audio : true,
			video : true
	}

	if (mode == 'video-only') {
		constraints.audio = false;
	} else if (mode == 'audio-only') {
		constraints.video = false;
	}
	
	return constraints;
}


function playResponse(message) {
	setState(IN_PLAY);
	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function playEnd() {
	setState(POST_CALL);
	hideSpinner(videoInput, videoOutput);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	ws.send(jsonMessage); //백엔드로 보내는거
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = "center transparent url('./img/spinner.gif') no-repeat";
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/person.png';
		arguments[i].style.background = '';
	}
}
/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
