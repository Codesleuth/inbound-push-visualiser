#!/bin/env node

var config = require('./config.json'),
    PushListener = require('./lib/pushlistener'),
    fs = require('fs'),
    http = require('http'),
    debug = require('debug'),
    path = require('path'),
    request = require('request');



var sampleMessages = (function () {
    var samples = ["Nice office!!", "Fancy a game of pool?", "Brilliant party!", "Ohhh nice roof terrace!", "Good luck Esendex!"];
    return samples.map(function (sample) {
        return { "timestamp": 1, "message": sample };
    });
})();


var messageLog = sampleMessages.concat(sampleMessages).concat(sampleMessages).concat(sampleMessages);
var messageLogLimit = 10;

var listener = new PushListener(config.accountid);
listener.debug = debug('app:listener');

listener.on('message', function (msg) {

    if (msg.type != "inbound")
        return;

    if (typeof config.forwardto === "string") {
        listener.debug('forwarding message to: %s', config.forwardto);
        var req = request({
            url: config.forwardto,
            body: msg.body,
            method: 'POST',
            headers: {
                "Content-Type": "application/xml"
            }
        }, function (err, res, body) {
          if (err || res && (res.statusCode < 200 || res.statusCode >= 300))
            listener.debug('forwarding error: %s', err || res.statusCode);
        });
    }

    var prefix = config.prefix || '';
    var messageText = msg.message.InboundMessage.MessageText[0];

    if (messageText.substring(0, prefix.length).toLowerCase() == prefix.toLowerCase()) {
        message = messageText.substring(config.prefix.length).trim();

        this.debug('Received message: %s', message);

        messageLog.push({
            "timestamp": Date.now(),
            "message": message
        });

        if (messageLog.length > messageLogLimit)
            messageLog.splice(0, messageLog.length - messageLogLimit);
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

var contentTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
}


var server = http.createServer(function (req, res) {

    this.debug('%s %s %s', req.headers['x-forwarded-for'] || req.connection.remoteAddress, req.method, req.url);

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


        var filename = __dirname + (req.url == "/" ? "/assets/index.html" : "/assets" + req.url);
        this.debug('looking for: ', filename);

        fs.exists(filename, function (exists) {
            if (exists) {
                var extension = path.extname(filename);
                var contentType = contentTypes[extension];
                res.writeHead(200, {'Content-Type': contentType});
                fs.createReadStream(filename).pipe(res);
            } else {
                reply404(res);
            }
        });

        return;
    }

    reply404(res);
});
server.debug = debug('app:server');

server.listen(config.port, config.address, function () {
    this.debug('started on http://%s:%d', config.address, config.port);
});
