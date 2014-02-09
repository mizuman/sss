
// CONFIG OPTIONS START

var accuracy = 8; // 1 = crotchet, 2 = quaver, 4 = semi-quaver, 8 = demi-semi-quaver
var bpm = 100; // beats per minute
var margin = 200; // How many milliseconds to forgive missed beats
var muted = ['']; // List muted (silent) instruments

// CONFIG OPTIONS END

// Audio speed settings
var count = 0;
var bps = bpm / 60; // beats per second
var interval = (1000 / bps / accuracy) >> 0; // seconds per beat
var multiplier = interval * accuracy;
var timer;
var countdown;

var currentBeat = {};
var lag = 0; // Time lag across the network
var isSession = false;

// for measurement transfer lag
var HBStartTime;
var lagList = {};

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

    for(var i=0; i<chatList.length && chatList[i] != peerid; i++);

    if(i==chatList.length) {
        var conn = peer.connect( $('#contactlist').val(), {"serialization": "json"} );
        dataChannelEvent(conn);
        $('#session-info').hide();
    }
      

}

// Audio contextを生成
var audioContext = new AudioContext();
var buffers = {};
var instruments = ['bd', 'sd', 'hh', 'cy'];
var req = new XMLHttpRequest();
var loadidx = 0;

// タッチサポートの判定
var SUPPORTS_TOUCH = 'createTouch' in document;
var mouse_down = (SUPPORTS_TOUCH ? 'ontouchstart' : 'onmousedown');

// UI要素の準備
var soundElements = {};
for (var i = 0, key; key = instruments[i]; i++) {
    soundElements[key] = document.getElementById('sounds-' + key);
}

function LoadBuffers() {
    req.open("GET", 'samples/' + instruments[loadidx] + '.wav', true);
    req.responseType = "arraybuffer";
    req.onload = function() {
        if(req.response) {
            audioContext.decodeAudioData(req.response,function(b){
                buffers[instruments[loadidx]] = b;
                if(++loadidx < instruments.length)
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
                if($.inArray(list[cnt],userList)<0 && list[cnt] != peer.id && list[cnt].search('host') == 0){
                    userList.push(list[cnt]);
                    $('#contactlist').append($('<option>', {"value":list[cnt],"text":list[cnt]}));
                }
            }
        }
    );
}

function sendMsg(type, message, instruments, key) {

	var data = {
		type: type,
		user: userName,
		text: message,
        inst: instruments,
        key : key
	};

    for(var i = 0; i < peerConn.length; i++){
    	peerConn[i].send(data);
    }
    // console.log(data);
}

function makeSounds(buffer){
    var source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function playSound(note) {
    // Play sound if instrument is not muted
    if (muted.indexOf(note.key) < 0) {
        makeSounds(buffers[note.key]);
    }
}

// 音楽に合わせて音を出すべきか
function checkSound() {
    if (drum.length < 1) {
        endMusic();
    } else if (drum[0].time * multiplier === count) {
        currentBeat = drum.shift();
        if ( currentBeat === null) endMusic();
        else currentBeat.data.forEach(playSound);
    }
    count = count + interval;
}

function endMusic() {
    isSession = false;
    window.clearInterval(timer);
}

function startMusic() {
    // 音楽用のタイマー
    timer = window.setInterval(checkSound, interval);
    checkSound();
    isSession = true;
}


function setPlayerList(player){
    for(var i=0; i < playerList.length && playerList[i] != player ; i++);
    if(i == playerList.length) playerList[playerList.length] = player;
    $('#session').append(player);

    if(playerList.length == chatList.length) {
        console.log("all mens ready!");
        heartBeat();
        clearTimeout(countdown);
        startMusic();
    }
}

function heartBeat(){
    if(lagList) console.log(lagList);
    HBStartTime = new Date();
    for(var i = 0; i < peerConn.length; i++){
        peerConn[i].send({type:'info',text:'heartbeat'});
    }
}

function getTransferLag(data){
    var HBEndTime = new Date();
    var lag = HBEndTime - HBStartTime;

    lagList[data.user] = (undefined) ? 0 : lag/2;

    // console.log('Transfer lag time : ' + data.user + ' ' + lag/2 + 'ms');
}

function showTiming(isGood) {
    if (isGood) {
        $('#history ul').prepend('<li>Great!</li>');
    } else {
        $('#history ul').prepend('<li>Oops</li>');
    }
}

function checkAccuracy(data) {
    var soundTime = count - lag; // lagList.peerid; 
    var nextBeat = drum[0];
    
    if (soundTime - currentBeat.time * multiplier < nextBeat.time * multiplier - soundTime) {
        // currentBeat is closest, i.e. user is late
        for (var i = 0, len = currentBeat.data.length; i < len; i++) {
            if (currentBeat.data[i].key === data.key) {
                if (soundTime - currentBeat.time * multiplier < margin) {
                    showTiming(true);
                } else {
                    showTiming(false);
                }
            }
        }
    } else {
        // nextBeat is closest, i.e. user is early
        for (var i = 0, len = nextBeat.data.length; i < len; i++) {
            if (nextBeat.data[i].key === data.key) {
                if (nextBeat.time * multiplier - soundTime < margin) {
                    showTiming(true);
                } else {
                    showTiming(false);
                }
            }
        }
    }
}

function dataChannelEvent(conn){
	peerConn[peerConn.length] = conn;
    $('#their-id').append(conn.peer);
    $("#sound-buttons").show();
    $("#session-call").show();

    chatList[chatList.length] = conn.peer;


    // for(var i = 0; i < peerConn.length; i++){
        peerConn[peerConn.length - 1].on('data', function(data){

            if(isSession){
                checkAccuracy(data);
            }
            
            // console.log(data);
            if(data.type === 'sound') {
                makeSounds(buffers[data.key]);
                $('#history ul').prepend('<li> ' + data.user + ' : ' + data.key + ' (' + data.inst + ')</li>');
            }
            else if(data.type == 'info'){
                if(data.text == 'Ready?') $("#session-response").show();
                if(data.text == 'OK!') setPlayerList(data.user);
                if(data.text == 'heartbeat') sendMsg('info','alive');
                if(data.text == 'alive') getTransferLag(data);
            }
        });
    // }

}


// イベントハンドラー
$(function(){
    $("#sound-buttons").hide();
    $("#session-call").hide();
    $("#session-response").hide();

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
        $('#session-call').text('募集中...');
        $('#session').append('join : ');  
    });

    $('#session-response').click(function(event) {
        sendMsg('info', 'OK!');
        $('#session-response').hide();
        // countdown = setTimeout('startMusic()',1000);
    });
 
    $('#music-start').click(function(event) {
        // // 音楽用のタイマー
        // timer = window.setInterval(checkSound, interval);
        // checkSound();
        startMusic();
    });
 
    soundElements['hh'][mouse_down] = function(event) {
        sendMsg('sound', 'hh', 'drum', 'hh');
        $('#history ul').prepend('<li> you : Hi-hat</li>');
    };
    soundElements['sd'][mouse_down] = function(event) {
        sendMsg('sound', 'sd', 'drum', 'sd');
        $('#history ul').prepend('<li> you : Snare Drum</li>');
    };
    soundElements['bd'][mouse_down] = function(event) {
        sendMsg('sound', 'bd', 'drum', 'bd');
        $('#history ul').prepend('<li> you : Bass Drum</li>');
    };
    // soundElements['cy'][mouse_down] = function(event) {
    //     sendMsg('sound', 'cy', 'drum', 'cy');
    //     $('#history ul').prepend('<li> you : Cymbal</li>');
    // };
    
    //ユーザリスト取得開始
    setInterval(getUserList, 2000);
    setInterval(heartBeat, 20000);
});