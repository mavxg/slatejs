//Copyright (c) 2015 Benjamin Thomas Norrington <ben@norrington.net>

// dummy websocket to fool ShareJS

//IDEA: mock other user editing the document.

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

Dummy.prototype._ack = function(opData) {
	this.emit(opData);

	op2 = {};
	for (var k in opData) if (k !== 'c' && k !== 'd')
		op2[k] = opData[k];
	this.emit(op2,2);
	this.emit({a:'ack'},3);
};

Dummy.prototype._create = function(opData, create) {
	var type = this.ottypes[create.type].uri;
	var data = create.data;
	var doc = this.collections[this.c][this.d];

	doc.v = opData.v;
	create.type = doc.type = type;
	doc.data = data;
	doc.docName = this.d;
	//TODO: do we need to set m:{mtime:..., ctime:...}

	opData.create = create;
	this._ack(opData);
};

Dummy.prototype._delete = function(opData, del) {
	var doc = this.collections[this.c][this.d];
	doc.v = opData.v;
	doc.data = null;

	opData.del = del;
	this._ack(opData);
};

Dummy.prototype._submitOp = function(opData, op) {
	var doc = this.collections[this.c][this.d];
	doc.v = opData.v;
	
	var ot = this.ottypes[doc.type];
	ot.apply(doc.data, op);

	opData.op = op;
	this._ack(opData);
};

Dummy.prototype._handleOp = function(req) {
	var opData = {op:req.op, v:req.v, src:req.src, seq:req.seq};

	if (req.c !== undefined) this.c = opData.c = req.c;
	if (req.d !== undefined) this.d = opData.d = req.d;

    // Fill in the src and seq with the client's data if its missing.
    if (!req.src) {
      opData.src = this.id;
      opData.seq = this.seq++;
    }

    if (req.create) this._create(opData, req.create);
    else if (req.del) this._delete(opData, req.del);
    else this._submitOp(opData, req.op);
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


c->s  {"a":"op","v":770,"op":[493," "],"c":"users","d":"seph"}
s->c  {"a":"op","c":"users","d":"seph","v":770,"src":"be419f6b3076fcf46216ed6236464c58","seq":2,"op":[493," "]}
s->c  {"a":"op","v":770,"src":"be419f6b3076fcf46216ed6236464c58","seq":2,"op":[493," "]}
s->c  {"a":"ack"}
*/

module.exports = Dummy;