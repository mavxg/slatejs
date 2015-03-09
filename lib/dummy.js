//Copyright (c) 2015 Benjamin Thomas Norrington <ben@norrington.net>

// dummy websocket to fool ShareJS

function Dummy(ottypes) {
	this.readyState = 1; //pretend to be open
	//send dummy init message
	this.id = "be419f6b3076fcf46216ed6236464c58";
	this._emit(
		{"a":"init","protocol":0,"id":this.id}, 10);
	this.collections = {};
	this.ottypes = ottypes;
	this.c = '';
	this.d = '';
	this.seq = 0;
}

Dummy.prototype.send = function(msg) {
	this._handleMessage(JSON.parse(msg));
};

Dummy.prototype._emit = function(msg, delay) {
	if (typeof this.onmessage !== 'function') return;
	setTimeout(this.onmessage, delay || 1, JSON.stringify(msg));
};

Dummy.prototype.close = function() {
	this.readyState = 3;
	if (typeof this.onclose !== 'function') return;
	setTimeout(this.onclose, 1);
};

Dummy.prototype.canSendWhileConnecting = true;
Dummy.prototype.canSendJSON = true;

Dummy.prototype._subLast = function() {
	this._emit({
		data: this.collections[this.c][this.d],
		a: "sub",
	});
};

Dummy.prototype._sub = function(msg) {
	this.c = msg.c;
	this.d = msg.d;
	if (!this.collections.hasOwnProperty(this.c)) this.collections[this.c] = {};
	var collection = this.collections[this.c];
	if (!collection.hasOwnProperty[this.d]) collection[this.d] = {v:0};
	this._emit({
		data: collection[this.d],
		a: 'sub',
		c: this.c,
		d: this.d
	});
};

Dummy.prototype._handleOp = function(req) {
	//TODO...
	var opData = {op:req.op, v:req.v, src:req.src, seq:req.seq};
    if (req.create) opData.create = req.create;
    if (req.del) opData.del = req.del;

    // Fill in the src and seq with the client's data if its missing.
    if (!req.src) {
      opData.src = this.id;
      opData.seq = this.seq++;
    }
};

Dummy.prototype._handleMessage = function(msg) {
	switch (msg.a) {
		case 'sub': return (msg.c === undefined) ? this._subLast(msg) : this._sub(msg);
		case 'op': return this._handleOp(msg);
	}
};

/*
c->s  {"a":"op","v":0,"create":{"type":"text","data":null}}
s->c  {"a":"op","v":0,"src":"be419f6b3076fcf46216ed6236464c58","seq":1,"create":{"type":"http://sharejs.org/types/textv1","data":null}}
s->c  {"a":"op","v":0,"src":"be419f6b3076fcf46216ed6236464c58","seq":1,"create":{"type":"http://sharejs.org/types/textv1","data":null}}
s->c  {"a":"ack"}
*/

module.exports = Dummy;