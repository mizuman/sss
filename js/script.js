// Compatibility
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

// SkyWay API Key for localhost
// var APIKEY = '6165842a-5c0d-11e3-b514-75d3313b9d05';
// SkyWay API Key for mizuman.github.io
// var APIKEY = '84db5394-8d3b-11e3-ab66-e500405b4002';
// SkyWay API Key for http://html5expertshackathon.github.io
var APIKEY = '1e1140a4-9099-11e3-87ef-c90d583d86c3';

// ユーザ名をランダムに生成
// var userName = 'guest' + Math.floor(Math.random() * 100);

// ユーザーリスト
var userList = [];
var chatList = [];
var playerList = [];

// PeerJSオブジェクトを生成
var peer = new Peer(userName,{ key: APIKEY});
// var peer = new Peer({ key: APIKEY, debug: 3});

// PeerJS data connection object
var peerConn = [];

// PeerIDを生成
peer.on('open', function(){
    $('#my-id').text(peer.id);
    getUserList();
});

peer.on('connection', function(conn){
	dataChannelEvent(conn);
});

// エラーハンドラー
peer.on('error', function(err){
    alert(err);
});

function connect(peerid){
    var conn = peer.connect( $('#contactlist').val(), {"serialization": "json"} );
    dataChannelEvent(conn);
}

// Audio contextを生成
var audioContext = new AudioContext();
var buffers = [];
var req = new XMLHttpRequest();
var loadidx = 0;
var files = [
    "samples/bd.wav",
    "samples/sd.wav",
    "samples/hh.wav",
    "samples/cy.wav"
];

// タッチサポートの判定
var SUPPORTS_TOUCH = 'createTouch' in document;
var mouse_down = (SUPPORTS_TOUCH ? 'ontouchstart' : 'onmousedown');

// UI要素の準備
// var beep = document.getElementById('beep');
var soundsHh = document.getElementById('sounds-hh');
var soundsSd = document.getElementById('sounds-sd');
var soundsBd = document.getElementById('sounds-bd');
var soundsCy = document.getElementById('sounds-cy');

function LoadBuffers() {
    req.open("GET", files[loadidx], true);
    req.responseType = "arraybuffer";
    req.onload = function() {
        if(req.response) {
            audioContext.decodeAudioData(req.response,function(b){
                buffers[loadidx]=b;
                if(++loadidx < files.length)
                    LoadBuffers();
            },function(){});
        }
    };
    req.send();
}

function getUserList () {
    //ユーザリストを取得
    $.get('https://skyway.io/active/list/'+APIKEY,
        function(list){
            for(var cnt = 0;cnt < list.length;cnt++){
                if($.inArray(list[cnt],userList)<0 && list[cnt] != peer.id){
                    userList.push(list[cnt]);
                    $('#contactlist').append($('<option>', {"value":list[cnt],"text":list[cnt]}));
                }
            }
        }
    );
}

function sendMsg(type, message, recipient) {
	var data = {
		type: type,
		user: userName,
		text: message
	};

    for(var i = 0; i < peerConn.length; i++){
    	peerConn[i].send(data);
    }
    console.log(data);
}

function makeSounds(buffer){
    var source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function playSounds(sounds){
    if(sounds == 'Hi-hat') makeSounds(buffers[0]);
    else if (sounds == 'Snare Drum') makeSounds(buffers[1]);
    else if (sounds == 'Bass Drum') makeSounds(buffers[2]);
    else if (sounds == 'Cymbal') makeSounds(buffers[3]);
}

function setPlayerList(player){
    playerList[playerList.length] = player;
}

function dataChannelEvent(conn){
	peerConn[peerConn.length] = conn;
    $('#their-id').append(conn.peer);
    $("#sound-buttons").show();
    $("#session-call").show();


    // for(var i = 0; i < peerConn.length; i++){
        peerConn[peerConn.length-1].on('data', function(data){
            console.log(data);
            if(data.type == 'sound'){
                playSounds(data.text);
                $('#history ul').prepend('<li> ' + data.user + ' : ' + data.text + '</li>');
            }
            else if(data.type == 'info'){
                if(data.text == 'Ready?') $("#session-answer").show();
                if(data.text == 'OK!') setPlayerList(data.user);
            }
        });
    // }

}


// イベントハンドラー
$(function(){
    $("#sound-buttons").hide();
    $("#session-call").hide();
    $("#session-answer").hide();

    // PCスマホ間のver違いによるエラー対策
    util.supports.sctp = false;

    // load sounds
    LoadBuffers();
    
    // イベントリスナーの追加
    $('#make-connection').click(function(event) {
        connect($('#contactlist').val());
    });

    $('#session-call').click(function(event) {
        sendMsg('info', 'Ready?');
    });

    $('#session-answer').click(function(event) {
        sendMsg('info', 'OK!');
    });
 
    // beep[mouse_down] = function(event) {
    //     sendMsg('sound', 'beep');
    //     $('#history ul').prepend('<li> you : beep</li>');
    // };

    soundsHh[mouse_down] = function(event) {
        sendMsg('sound', 'Hi-hat');
        $('#history ul').prepend('<li> you : Hi-hat</li>');
    };
    soundsSd[mouse_down] = function(event) {
        sendMsg('sound', 'Snare Drum');
        $('#history ul').prepend('<li> you : Snare Drum</li>');
    };
    soundsBd[mouse_down] = function(event) {
        sendMsg('sound', 'Bass Drum');
        $('#history ul').prepend('<li> you : Bass Drum</li>');
    };
    soundsCy[mouse_down] = function(event) {
        sendMsg('sound', 'Cymbal');
        $('#history ul').prepend('<li> you : Cymbal</li>');
    };

    //ユーザリスト取得開始
    setInterval(getUserList, 2000);
});