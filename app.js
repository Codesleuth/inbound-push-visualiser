#!/bin/env node

var config = require('./config.json'),
    PushListener = require('./lib/pushlistener'),
    fs = require('fs'),
    http = require('http'),
    debug = require('debug');



var sampleMessages = (function () {
    var now = Date.now();
    return [{
        "timestamp": now - 5,
        "message": "Nice office!!"
    },{
        "timestamp": now - 4,
        "message": "Fancy a game of pool?"
    },{
        "timestamp": now - 3,
        "message": "Brilliant party!"
    },{
        "timestamp": now - 2,
        "message": "Ohhh nice roof terrace!"
    },{
        "timestamp": now - 1,
        "message": "Good luck Esendex!"
    }];
})();


var messageLog = sampleMessages.concat(sampleMessages).concat(sampleMessages);


var listener = new PushListener(config.accountid);
listener.debug = debug('app:listener');

listener.on('message', function (msg) {

    if (msg.type != "inbound")
        return;

    var prefix = config.prefix || '';
    var messageText = msg.message.InboundMessage.MessageText[0];

    if (messageText.substring(0, prefix.length).toLowerCase() == prefix.toLowerCase()) {
        message = messageText.substring(config.prefix.length).trim();

        this.debug('Received message: %s', message);

        if (messageLog.length > 100)
            messageLog.splice(100);

        messageLog.push({
            "timestamp": Date.now(),
            "message": message
        });
    }
});

listener.listen();


function getLogsFromTimestamp(timestamp) {
    if (timestamp <= 0 || messageLog.length == 0 || timestamp < messageLog[0].timestamp)
        return messageLog;

    var results = [];

    if (timestamp > messageLog[messageLog.length-1].timestamp)
        return results;

    for (var i = 0, l = messageLog.length; i < l; i++) {
        var msg = messageLog[i];
        if (msg.timestamp > timestamp) {
            results.push(msg);
        }
    };

    return results;
}


function reply404(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
}


var server = http.createServer(function (req, res) {

    this.debug('%s %s', req.method, req.url);

    if (req.method == 'GET') {
        if (req.url == '/messages' || req.url.indexOf('/messages?') == 0) {
            res.writeHead(200, {'Content-Type': 'application/json'});

            var m = messageLog;
            if (req.url.indexOf('/messages?') == 0) {
                var rightPart = req.url.substring(10);
                var params = rightPart.split('&');

                for (var i = params.length - 1; i >= 0; i--) {
                    var param = params[i];

                    var divider = param.indexOf('=');
                    var key = param.substring(0, divider);

                    if (key == 'from') {
                        var value = param.substring(divider + 1);
                        m = getLogsFromTimestamp(value);
                        break;
                    }
                };
            }

            res.end(JSON.stringify({ "messages": m }));
            return;
        }

        if (req.url == '/index.css') {
            var filename = __dirname + "/assets/index.css";
            fs.exists(filename, function (exists) {
                if (exists) {
                    res.writeHead(200, {'Content-Type': 'text/css'});
                    fs.createReadStream(filename).pipe(res);
                } else {
                    reply404(res);
                }
            });
            
            return;
        }

        if (req.url == '/jquery.min.js') {
            var filename = __dirname + "/assets/jquery.min.js";
            fs.exists(filename, function (exists) {
                if (exists) {
                    res.writeHead(200, {'Content-Type': 'application/javascript'});
                    fs.createReadStream(filename).pipe(res);
                } else {
                    reply404(res);
                }
            });
            
            return;
        }

        if (req.url == '/') {
            var filename = __dirname + "/assets/index.html";
            fs.exists(filename, function (exists) {
                if (exists) {
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    fs.createReadStream(filename).pipe(res);
                } else {
                    reply404(res);
                }
            });
            return;
        }
    }

    reply404(res);
});
server.debug = debug('app:server');

server.listen(config.port, config.address, function () {
    this.debug('started on http://%s:%d', config.address, config.port);
});