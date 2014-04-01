var EventSource = require('eventsource'),
    debug = require('debug')('push-listener'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

function PushListener(accountId, url) {
    this.accountId = accountId || '00000000-0000-0000-0000-000000000000';
    this.url = url || 'http://push-codesleuth.rhcloud.com/listen/';
    this.listener = null;
}

util.inherits(PushListener, EventEmitter);

PushListener.prototype.listen = function () {
    this.listener = new EventSource(this.url + this.accountId);
    this.listener.PushListener = this;
    this.listener.onerror = this.errorHandler;
    this.listener.onmessage = this.messageHandler;
}

PushListener.prototype.errorHandler = function (e) {
    debug('PushListener error: ', e);
    this.PushListener.emit('onerror', e);
}

PushListener.prototype.messageHandler = function(message) {
    var json = JSON.parse(message.data);

    if (json && json.event == "connect") {
        debug('PushListener connected with account ID: %s', json.accountId);
        this.PushListener.emit('connect', json.accountId);
    }
    else {
        debug('PushListener received %s message', json.message.type);
        this.PushListener.emit('message', json);
    }
}

module.exports = PushListener;