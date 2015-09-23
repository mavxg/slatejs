/* Encryption plugin --- support encrypted sections of document */

var openpgp = require('openpgp');
var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var cfb = openpgp.crypto.cfb;
var random = openpgp.crypto.random;

//not IE9 or before
var s2r = window.btoa;
var r2s = window.atob;

var render = require('../render');
var renderChildren = render.renderChildren;
var renderers = render.renderers;

var ot = require('ot-sexpr');
var List = ot.List;
var AttributedString = ot.AttributedString;
var sym = ot.sym;
var Selection = ot.Selection;
var Region = ot.Region;

function serialise_op(op) {
	var ret = [];
	var ins = true;
	for (var i = 0; i < op.length; i++) {
		var o = op[i];
		if (ins && (o.op === 'delete')) {
			ret.push('d');
			ins = (o.op === 'insert');
		} else if (!ins && (o.op === 'insert')) {
			ret.push('i');
			ins = true;
		}
		if (o.attributes) {
			var as = JSON.stringify(o.attributes);
			ret.push(as.length + 'a' + as);
		}
		if (o.unattributes) {
			var as = JSON.stringify(o.unattributes);
			ret.push(as.length + 'u' + as);
		}
		switch (o.op) {
			case 'retain':
				ret.push(o.n + 'r');
				break;
			case 'insert':
			case 'delete':
				var s;
				switch (o.type) {
					case 'push':
						ret.push(o.value === 'list' ? '(' : "`");
						break;
					case 'pop':
						ret.push(o.value === 'list' ? ')' : "'");
						break;
					case 'char':
						ret.push(o.value.length + 'c' + o.value);
						break;
					case 'sym':
						ret.push(o.value.length + 'y' + o.value);
						break;
					case 'obj':
					default:
						s = JSON.stringify(o.value);
						ret.push(s.length + 'o' + s);
						break;

				}
				break;
			case 'start':
				ret.push('<');
				break;
			case 'stop':
				ret.push('>');
				break;
			default:
				throw "Unknow op for serialisation";
		}
	};
	return ret.join('');
}

function deserialise_op(op) {
	var t = ot.operations;
	var insert = t.insert;
	var ret = [];
	var ins = true;
	var d = 0;
	var l = op.length;
	var attributes;
	var unattributes;
	for (var i = 0; i < l; i++) {
		var o = op[i]; //character
		switch (o) {
			case '0':
			case '1':
			case '2':
			case '3':
			case '4':
			case '5':
			case '6':
			case '7':
			case '8':
			case '9':
				if (d > 0) 
					d = d * 10 + (+o);
				else
					d = (+o);
				break;
			case 'i':
				insert = t.insert;
				break;
			case 'd':
				insert = t.delete;
				break;
			case 'a':
				attributes = JSON.parse(op.slice(i+1,i+1+d));
				i +=d;
				d = 0;
				break;
			case 'u':
				unattributes = JSON.parse(op.slice(i+1,i+1+d));
				i +=d;
				d = 0;
				break;
			case '(':
				ret.push(insert('list','push',attributes, unattributes));
				attributes = undefined;
				unattributes = undefined;
				break;
			case ')':
				ret.push(insert('list','pop'));
				break;
			case '`':
				ret.push(insert('string','push'));
				break;
			case '\'':
				ret.push(insert('string','pop'));
				break;
			case 'r':
				ret.push(t.retain(d));
				d = 0;
				break;
			case 'c':
				ret.push(insert(op.slice(i+1,i+1+d),'char',attributes, unattributes));
				attributes = undefined;
				unattributes = undefined;
				i +=d;
				d = 0;
				break;
			case 'y':
				ret.push(insert(op.slice(i+1,i+1+d),'sym',attributes, unattributes));
				attributes = undefined;
				unattributes = undefined;
				i +=d;
				d = 0;
				break;
			case 'o':
				ret.push(insert(JSON.parse(op.slice(i+1,i+1+d)),'obj'));
				i +=d;
				d = 0;
				break;
			case '<':
				ret.push(ot.operations.start);
				break;
			case '>':
				ret.push(ot.operations.end);
				break;
			default:
				throw "Unknown character in op: " + op;

		}
	};
	return ret;
}

var keyToId = require('../ids').keyToId;

if (window && window.msCrypto) window.crypto = window.msCrypto;

//return the offset of an encrypted node by id
List.prototype.findEncryptedNodeById = function(id, offset) {
	offset = offset || 0;
	if (!this.containsEncrypted()) return;
	if (this.id === id) return {offset:offset, node:this};
	offset += 1;
	for (var i = 0; i < this.values.length; i++) {
		var n = this.values[i];
		var res;
		if (n instanceof List) {
			res = n.findEncryptedNodeById(id, offset);
			if (res) return res;
			offset += n.size;
		} else if (n instanceof AttributedString) {
			offset += n.size;
		} else {
			offset += 1;
		}
	};
	return;
};
//check if a list contains an encrypted section
List.prototype.containsEncrypted = function() {
	if (this._containsEncrypted !== undefined)
		return this._containsEncrypted;
	if (this.head() && this.head().sym === 'encrypted')
		return (this._containsEncrypted = true);
	for (var i = this.values.length - 1; i >= 0; i--) {
		var n = this.values[i];
		if (n instanceof List && n.containsEncrypted())
			return (this._containsEncrypted = true);
	};
	return (this._containsEncrypted = false);
};
//return a list of regions for encrypt nodes
List.prototype.encryptRegions = function() {
	if (this._encryptRegions !== undefined)
		return this._encryptRegions;
	if (this.head().sym === 'encrypt') {
		//calculate keys and ops end
		var keysize = this.index(1).size;
		var instructions = this.index(2).size;
		return (this._encryptRegions = [{
			id:this.id,
			begin:0,
			ins:(keysize + 4), //start of instruction
			start:(keysize + 2 + instructions),
			end:(this.size - 1),
		}]);
	}
	//optimization for section level encryption (only)
	// **** this will not work if we allow encryption
	//      within sections.
	if (this.head().sym === 'section')
		return (this._encryptRegions = []);
	
	//find and adjust encrypt regions of children
	var regions = [];
	var offset = 1;

	function add_region(r) {
		regions.push({
			id:r.id,
			begin:(r.begin + offset), //start of node
			ins:(r.ins + offset), //start of instructions
			start:(r.start + offset), //start of unencrypted range
			end:(r.end + offset), //end of unencrypted range
		});
	}

	for (var i = 0; i < this.values.length; i++) {
		var child = this.values[i];
		if (child instanceof List) {
			child.encryptRegions().forEach(add_region);
			offset += child.size;
		} else if (child instanceof AttributedString) {
			offset += child.size
		} else {
			offset += 1;
		}
	};
	return regions;
};

function EncryptedContext(context, editor) {
	var self = this;
	this.editor = editor;
	this.privateKeys = {};
	this.defaultKey;
	this.publicKeys = {};
	this.aesKeys = {}; //node id to string key
	this.context = context;
	this._onOp = context._onOp;
	this._snapshot = context.getSnapshot();
	this.context._onOp = function(op) {
		//check for keys and ops
		var doDecryption = false;
		var unenc_op = [];
		var regions = self._snapshot.encryptRegions();
		var ri = 0;
		var r = regions[ri];
		var offset = 0;
		var r_ops = [];
		var d_ops = [];

		for (var i = 0;i<op.length;i++) {
			var o = op[i];
			switch (o.op) {
				case 'retain':
					if (r_ops.length > 0) {
						var n = o.n;
						//retain to start
						unenc_op.push(ot.operations.retain(r.start-offset,
							o.attributes,o.unattributes));
						//add r_ops
						unenc_op = unenc_op.concat(ot.compose(r_ops,ot.invert(d_ops)));
						r_ops = [];
						d_ops = [];
						//retain rest
						n -= (r.start-offset);
						if (n > 0)
							unenc_op.push(ot.operations.retain(n,
								o.attributes,o.unattributes));
					} else {
						unenc_op.push(o);
					}
					offset += o.n;
					break;
				case 'delete':
					unenc_op.push(o);
					if (r && offset >= r.ins && offset < r.start) {
						var io = self.decrypt_op(o.value, r);
						d_ops = ot.compose(d_ops, io);
					}
					offset += o.n;
					break;
				case 'insert':
					if (r && offset >= r.ins && offset < r.start) {
						var io = self.decrypt_op(o.value, r);
						r_ops = ot.compose(r_ops, io);
					}
					else if (o.type === 'obj' &&
						typeof o.value === 'object' &&
						Object.keys(o.value).join(':') === 'id:public:key')
						doDecryption = true;
					unenc_op.push(o);
					break;
				default:
					unenc_op.push(o);
					break;
			}
			while (r && offset >= r.start) {
				//skip over the unencrypted.
				offset += (r.end - r.start);
				unenc_op.push(ot.operations.retain(r.end-r.start));
				ri++;
				r = regions[ri];
			}
		}
		if (r_ops.length > 0) {
			unenc_op.push(ot.operations.retain(r.start-offset));
			unenc_op = unenc_op.concat(ot.compose(r_ops,ot.invert(d_ops)));
		}

		console.log(JSON.stringify(unenc_op));

    	self._snapshot = ot.apply(self._snapshot, unenc_op);
		if (self._onOp) self._onOp(unenc_op);

		if (doDecryption)
			self._decryptSnapshot();
	}
}
EncryptedContext.prototype.getSnapshot = function() {
	return this._snapshot;
};

//marks a region as critical
//unless it just contains retain
function mark_critical(op, r) {
	var _op = [];
	var start = r.start;
	var end = r.end;
	var offset = 0;
	var open = false;
	for (var i=0; i<op.length; i++) {
		var o = op[i];
		switch (o.op) {
			case 'retain':
				var n = o.n;
				var attributes = o.attributes;
				var unattributes = o.unattributes;
				if (offset < start && offset + n >= start && offset + n < end) {
					_op.push(ot.operations.retain(start - offset,
						attributes, unattributes));
					_op.push(ot.operations.start); //start critical
					open = true;
					n -= (start - offset);
					offset = start;
				}
				if (open && offset + n >= end) {
					_op.push(ot.operations.retain(end - offset,
						attributes, unattributes));
					_op.push(ot.operations.end); //end critical
					open = false;
					n -= (end - offset);
					offset = end;
				}
				if (n > 0) {
					_op.push(ot.operations.retain(n, 
						attributes, unattributes));
					offset += n;
				}
				break;
			case 'delete':
				offset += o.n;
				_op.push(o);
				if (offset === start) {
					_op.push(ot.operations.start); //start critical
					open = true;
				}
				if (open && offset === end) {
					_op.push(ot.operations.end); //end critical
					open = false;
				}
				break;
			default:
				_op.push(o);
				break; //none of the other ops should affect input offset
		}
	}
	if (open && offset < end) {
		_op.push(ot.operations.retain(end - offset));
		_op.push(ot.operations.end); //end critical
	}
	return _op;
}

function mark_criticals(op, rs) {
	var _op = op;
	for (var i=0; i<rs.length; i++) {
		_op = mark_critical(_op, rs[i]);
	}
	return _op;
}

EncryptedContext.prototype.encrypt_op = function(op, region) {
	var s_op = serialise_op(op);
	var iv = random.getRandomBytes(16);
	var key = this.aesKeys[region.id];
	var e_op = cfb.normalEncrypt('aes256', key, s_op, iv);
	return {iv:s2r(iv), op:s2r(e_op)};
};
EncryptedContext.prototype.decrypt_op = function(op, region) {
	var key = this.aesKeys[region.id];
	var dop = cfb.normalDecrypt('aes256', key, r2s(op.op), r2s(op.iv));
	return deserialise_op(dop);
};
EncryptedContext.prototype.submitOp = function(op) {
	var self = this;
	var regions = this._snapshot.encryptRegions();

	if (regions.length === 0) {
		this._snapshot = ot.apply(this._snapshot, op);
		return this.context.submitOp(op);
	}

	//adjust the op with critical regions
	//op = mark_criticals(op, regions.map(function(r) {
	//	return {start:r.begin, end:(r.end+1)};
	//}));

	var n = 0;
	var i = 0;
	var l_o = 0;
	var leops = [];
	//make encrypted ops
	for (var ri=0;ri<regions.length;ri++) {
		var r = regions[ri];
		var s = r.start;
		if (n > r.end) continue; //skip this region
		while (n < s && i <op.length) {
			var o = op[i];
			switch(o.op) {
				case 'retain':
					n += o.n;
					break;
				case 'delete':
					if (o.type === 'sym' && o.value === 'encrypt')
						s = r.end + 1; //we should be deleting it all
					n += o.n;
					break;
			}
			i++;
		}
		if (i === op.length) break; //out of ops
		if (n > r.end) continue;
		var eops = [];
		if (n > r.start)
			eops.push(ot.operations.retain(n-r.start));
		while (n <= r.end && i<op.length) {
			var o = op[i];
			//encrypt all the ops until the end.
			ot._push(eops, o);
			switch (o.op) {
				case 'retain':
				case 'delete':
					n += o.n;
					break;
			}
			i++;
		}
		//trim off the last retain.
		eops = ot._trim(eops);
		if (eops.length === 0) continue;
		//encrypt ops
		var ins_end = r.start - 1;
		ot._push(leops, ot.operations.retain(r.begin - l_o));
		leops.push(ot.operations.start);
		leops.push(ot.operations.retain(ins_end - r.begin));
		leops.push(ot.operations.insert(this.encrypt_op(eops, r),'obj'));
		leops.push(ot.operations.retain(r.end - ins_end));
		leops.push(ot.operations.end);
	}

	var lop = op;
	if (leops.length > 0) {
		leops = ot.transform(leops, op);
		lop = ot.compose(op,leops);
	} 
	//filter ops for server
	//TODO (...This is where a makeTake might help....)
	var xops = []; // lop;
	var take = ot._makeTake(lop).take;
	var chunk;
	n = 0;
	for (var ri=0;ri<regions.length;ri++) {
		var r = regions[ri];
		var length = r.start - n;

		//gobble to start
		while (length > 0) {
			chunk = take(length, 'delete');
			if (chunk.op === 'insert'
				&& chunk.type === 'sym'
				&& chunk.value === 'encrypt')
				chunk = ot.operations.insert(
					chunk.value,
					chunk.type,
					chunk.attributes);
			ot._push(xops, chunk)
			if (chunk.op === 'retain' || chunk.op === 'delete')
				length -= chunk.n
		}
		//delete to end 
		length = r.end + 1 - r.start;
		while (length > 0) {
			chunk = take(length, 'insert');
			if (chunk.op === 'retain' || chunk.op === 'delete')
				length -= chunk.n
		}
		ot._push(xops, ot.operations.retain(1));
		n = r.end + 1;
	}
	//gobble rest
	while ((chunk = take(-1))) {
		if (chunk.op === 'insert'
			&& chunk.type === 'sym'
			&& chunk.value === 'encrypt') {
			chunk = ot.operations.insert(
				chunk.value,
				chunk.type,
				chunk.attributes);
		}
		ot._push(xops, chunk);
	}
	xops = ot._trim(xops);
	//send to server
	this.context.submitOp(xops);
	//apply locally
	this._snapshot = ot.apply(this._snapshot, op);
	if (leops.length > 0) {
		this._snapshot = ot.apply(this._snapshot, leops);
		if (this._onOp) this._onOp(leops);
	}	
	return;

	//END OF rewrite.... 


	//console.log(JSON.stringify(regions));

	var ri = 0;
	var r = regions[ri];
	var enc_op = []; //transformed op for remote
	var l_op = []; //transformed op for local
	var offset = 0; //local offset
	var r_op = []; //region ops temp storage
	var l_retain = 0;
	var r_deleted = false;
	//transform to offsets from end of keys
	for (var i=0;i<op.length;i++) {
		var o = op[i];
		switch (o.op) {
			case 'retain':
				var n = o.n;
				var ln = n;
				//TODO: need to do stuff with attributes here.
				if (r && offset >= r.start) {
					if (r_deleted) throw "Cannot delete part of an encrypted region";
					//retain starts in the region
					// ... ops ...) ... ^ ...)
					if (offset + n <= r.end) {
						//retain starts and ends in the region
						r_op.push(o);
						n = 0;
					} else {
						//retain consumes past end of region
						//assume we have retained to end of ops
						// distance to end
						var delta = r.end - offset;
						n -= delta;
						//ln -= delta;
						//add encrypted ops to local and remote
						if (r_op.length > 0) {
							var encrypted_op = ot.operations.insert(this.encrypt_op(r_op, r),'obj');
							enc_op.push(encrypted_op);
							//l_op.push(ot.operations.retain(l_retain));
							l_op.push(encrypted_op);
							//l_retain = 0;
						}
						//retain out of ops
						enc_op.push(ot.operations.retain(1));
						//l_retain += (1 + r_size);
						//if (delta > 0) {
						//	l_retain += delta;
						//}
						//both should now be at end of region
						//reset region ops
						r_op = [];
						//r_size = 0;
						ri++;
						r = regions[ri];
					}
				}
				//ln = n;
				//gobble all the regions we span
				while (r && r.end < (offset + o.n)) {
					n -= (r.end - r.start);
					ri++;
					r = regions[ri];
				}
				if (n < 0) throw "We somehow got a negative retain (1)";
				if (r && r.start <= (offset + o.n)) {
					//end of retain starts in the next region
					var e = (offset + o.n);
					var delta = e - r.start;
					//retain to end of ops (1 before start)
					n -= (delta + 1);
					ln -= (delta + 1);
					if (n < 0) throw "We somehow got a negative retain (2)";
					//add the portion of retain into region to region op
					if (delta > 0) {
						r_op.push(ot.operations.retain(delta));
						//r_size += delta;
					}
					l_op.push(ot.operations.retain(l_retain + ln));
					l_retain = delta + 1;
					ln = 0;
				}
				if (n > 0)
					enc_op.push(ot.operations.retain(n));
				if (ln > 0)
					l_retain += ln;
				offset += o.n;
				break;
			case 'delete':
				//delete start of encrypted node
				if (r && offset === r.begin) {
					// assume we delete whole encrypted nodes
					// otherwise things go strange
					r_deleted = true;
				}
				if (r && offset >= r.start) {
					r_op.push(o); //delete inside region
				} else {
					enc_op.push(o); //delete outside region
				}
				offset += o.n;
				while (r && offset > r.end) {
					//deleted passed the end of the region
					if (r_deleted) {
						if (r_op.length > 0) throw "We have ops from a deleted region"
						r_deleted = false;
					}
					ri++;
					r = regions[ri];
				}
				break;
			default:
				if (r && offset >= r.start && !r_deleted) {
					r_op.push(o); //inside region
					l_retain += (o.n || 0);
				} else {
					//outside region
					l_retain += (o.n || 0);
					//l_op.push(ot.operations.retain(o.n || 0));
					enc_op.push(o);
				}
				break;
		}
	}
	if (r_op.length > 0) {
		//assume we have retained to end of ops
		//retain to end of ops
		var encrypted_op = ot.operations.insert(this.encrypt_op(r_op, r),'obj');
		enc_op.push(encrypted_op);
		//l_op.push(ot.operations.retain(l_retain));
		l_op.push(encrypted_op);
	}

	if (l_op.length > 0) {
		console.log('Local:')
		console.log(JSON.stringify(l_op));
		this._snapshot = ot.apply(this._snapshot, l_op);
		if (this._onOp) this._onOp(l_op);
	}

	var xenc_op = [];
	for (var i = 0; i < enc_op.length; i++)
		ot._push(xenc_op,enc_op[i]);
	this.context.submitOp(xenc_op);
};
EncryptedContext.prototype.importKey = function(ascii, passphrase) {
	var keys = openpgp.key.readArmored(ascii).keys;
	var doDecryption = false;
	var ret;
	for (var i = keys.length - 1; i >= 0; i--) {
		var key = keys[i];
		if (key.isPrivate()) {
			doDecryption = true;
			if (passphrase && !key.primaryKey.isDecrypted)
				key.decrypt(passphrase);
			ret = this.privateKeys[key.primaryKey.keyid.toHex()] = key;
			key = key.toPublic();
			if (key && !this.defaultKey)
				this.defaultKey = key;
		}
		if (key)
			ret = this.publicKeys[key.primaryKey.keyid.toHex()] = key;
	};
	if (doDecryption)
		this._decryptSnapshot();
	return ret; //return the public key
};
EncryptedContext.prototype._decryptSnapshot = function(node) {
	node = node || this._snapshot;
	if (!node.containsEncrypted())
		return;
	if (node.head().sym === 'encrypted')
		return this.decryptNode(node.id);
	for (var i = 0; i < node.values.length; i++) {
		var child = node.values[i];
		if (child instanceof List)
			this._decryptSnapshot(child);
	}
};
EncryptedContext.prototype._apply = function(op) {
	//apply ops to the local snapshot only
	this._snapshot = ot.apply(this._snapshot, op);
	if (this._onOp) this._onOp(op);
};
EncryptedContext.prototype.decryptNode = function(id) {
	console.log('decryptNode: ' + id);
	var nx = this._snapshot.findEncryptedNodeById(id);
	var node = nx.node;
	var offset = nx.offset;
	var keys = node.index(1);
	if (!keys) {
		console.log('No keys')
		return -1; //this node doesn't have any keys yet
	}
	var aes = this.aesKeys[node.id];
	if (!aes) {
		//console.log(node.toSexpr())
		keys = keys.values.slice(1);
		var pk = false;
		for (var i = keys.length - 1; i >= 0; i--) {
			var key = keys[i];
			if ((pk = this.privateKeys[key.id]))
				break;
		};
		if (!pk) return -1;
		//decrypt aes key
		var msg = openpgp.message.readArmored(key.key);
		msg = msg.decrypt(pk);
		aes = r2s(msg.getText());
		this.aesKeys[node.id] = aes;
	}
	console.log('Decrypting Node: ' + node.id)

	var ops = node.prefix(1,2,ot.operations.delete);
	ops.unshift(ot.operations.retain(offset + 1));
	ops.push(ot.operations.insert('encrypt','sym'));
	//retain to after ops
	ops.push(ot.operations.retain(node.index(1).size + node.index(2).size));

	offset += 2 + node.size; //return offset after keys

	//decrypt ops after keys
	var dops = [];
	node.index(2).values.slice(1).forEach(function(o) {
		var op = cfb.normalDecrypt('aes256', aes, r2s(o.op), r2s(o.iv));
		op = deserialise_op(op);
		dops = ot.compose(dops, op);
	});
	ops = ops.concat(dops);

	this._apply(ops);
};
EncryptedContext.prototype.squash = function() {
	var regions = this._snapshot.encryptRegions();
	console.log('Squash: ' + JSON.stringify(regions));

	var l_ops = [];
	var r_ops = [];
	var offset = 0;
	var r_delta = 0;
	for (var i = 0; i < regions.length; i++) {
		var r = regions[i];
		//don't bother squashing if we only have 2 ops
		if (r.start - r.ins <= 3) {
			//adjust the remote delta
			r_delta += (r.end - r.start);
			continue;
		}
		//generate op from the unencrypted document
		var rop = this._snapshot.prefix(r.start, r.end);
		//delete existing ops
		var dops = this._snapshot.prefix(r.ins, r.start-1,ot.operations.delete);
		var op = [];
		for (var j=0;j<dops.length;j++) {
			var o = this.decrypt_op(dops[j].value,r);
			op = ot.compose(op, o);
		}
		//console.log(JSON.stringify(op));
		//console.log(JSON.stringify(rop));

		//insert new op
		dops.unshift(ot.operations.insert(this.encrypt_op(op,r), 'obj'));
		console.log(JSON.stringify(dops))

		//calculate retains for local and remote
		var lr = r.ins - offset;
		l_ops.push(ot.operations.retain(lr));
		r_ops.push(ot.operations.retain(lr-r_delta));
		l_ops = l_ops.concat(dops);
		r_ops = r_ops.concat(dops);
		offset = r.ins + (r.start - 1 - r.ins);
		r_delta = (r.end - r.start);

	}
	console.log(JSON.stringify(l_ops));
	//apply locally
	this._apply(l_ops);
	//send to server
	this.context.submitOp(r_ops);
};

/*

//ops are retain from start of the encrypted area. If they contain
// a sequence number then you can apply them in sequence.

(encrypted (keys {id:..., key:...}) (ops ....))
 -- where each op is {r:rev, iv:..., op:encryptedop}

 //we keep the encryped ops on the unencrypted document so we 
 don't need to know how long they are. It also makes squash easier

(encrypt (keys {}) ... objects created by ops ... (ops ....))


*/

var Keys = createClass({
	render: function() {
		var id = keyToId(this.props.keys.id)
		var children = this.props.keys.values.slice(1).map(function(k) {
				return Key({key:k});
			});
		return DOM.div({id:id, className:"content"},[
			DOM.h2({},this.props.title || "Keys"),
			DOM.div({},children)]);
	}
});

var Key = createClass({
	render: function() {
		var key = this.props.key;
		var id = key.id;
		var pub = openpgp.key.readArmored(key.public).keys[0];
		window.pub = pub;
		return DOM.div({id:id},pub.getUserIds().map(
			function(u) { return DOM.p({},u); })
		);
	}
})

var NEW_P = (function() {
	var npl = new List();
	npl.push(sym('p'));
	npl.push(new AttributedString(""));
	return npl.prefix(0,npl.size);
})();

var NEW_OPS = (function() {
	var n = new List();
	n.push(sym('ops'));
	return {op:n.prefix(0,n.size), size:n.size};
})();

function new_encrypt_key(context, editor, pub, id) {
	//generate aes secure key
	var aes = random.getRandomBytes(32); //for aes256
	var apub = pub.armor();
	var keyid = pub.primaryKey.keyid.toHex()
	
	//pgp encrypt the aes key and store it on the document
	var msg = openpgp.message.fromText(s2r(aes));
    msg = msg.encrypt([pub]);
    var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    	msg.packets.write());
    //add key to encrypted region
    var new_keys = new List();
    new_keys.push(sym('keys'));
    new_keys.push({id:keyid ,public:apub, key:armored});

    var offset = context._snapshot.findEncryptedNodeById(id).offset;
    //register key.
    context.aesKeys[id] = aes;
    //insert the keys.
    var ops = [ot.operations.retain(offset + 2)];
    ops = ops.concat(new_keys.prefix(0,new_keys.size));
    ops = ops.concat(NEW_OPS.op);
    editor.apply(ops); //editor apply not context._apply so the server gets the keys
    //decrypt node

    //var nx = context._snapshot.findEncryptedNodeById(id);
    context.decryptNode(id);

    //add new paragraph
    var start = offset + 2 + new_keys.size + NEW_OPS.size
    ops = [ot.operations.retain(start)];
    ops = ops.concat(NEW_P);
    var selection = new Selection([new Region(start + 4)]);
    editor.apply(ops, selection);
    editor.ensureFocus();
    editor.scrollToCursor();
}

function new_share_key(context, editor, pub, id) {
	//get secret key
	var aes = context.aesKeys[id];
	if (!aes) return;
	var apub = pub.armor();
	var keyid = pub.primaryKey.keyid.toHex();

	var nx = context._snapshot.findEncryptedNodeById(id);
	var offset = nx.offset;
	var node = nx.node;

	var keys = node.index(1);
	var existing = keys.values.slice(1);
	if (existing.some(function(k) {
		return k.id === keyid;
	})) return; // already shared with key
	
	//pgp encrypt the aes key and store it on the document
	console.log("Sharing: " + aes);
	var msg = openpgp.message.fromText(s2r(aes));
	console.log("encrypt")
    msg = msg.encrypt([pub]);
    console.log('armor')
    var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    	msg.packets.write());
    //add key to encrypted region
    var new_key = {id:keyid ,public:apub, key:armored};
    if (offset === -1)
    	throw "Cannot find node offet to encrypt.";
    //insert the key.
    var ops = [
    	ot.operations.retain(offset + 2 + keys.size - 1),
   		ot.operations.insert(new_key,'obj')
   	];
    editor.apply(ops);
}

var Encrypted = createClass({
	handleEncrypt: function(e) {
		e.preventDefault();
		var id = this.props.obj.id;
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.form.node;
		var akey = form.key.value;
		var passphrase = form.passphrase.value;
		var pub = context.importKey(akey,passphrase);
		if (pub && !(pub.isPrivate()))
			new_encrypt_key(context, editor, pub, id);
	},
	handleUnlock: function(e) {
		e.preventDefault();
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.form.node;
		var akey = form.key.value;
		var passphrase = form.passphrase.value;
		var pub = context.importKey(akey,passphrase);
		if (!pub) {
			this.setState({error:"Invalid key"});
		}
		return;
	},
	toggleUnlock: function(e) {
		this.setState({showUnlockForm:(!this.state.showUnlockForm)});
		e.preventDefault();
		e.stopPropagation();
	},
	render: function() {
		var obj = this.props.obj;
		var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
		var editor = this.props.editor;
		var props = {
			id: keyToId(obj.id),
			className: 'encrypted',
			
		};
		//wrap in form so the edtor recognises the clicks
		var toggle = DOM.form({},[DOM.a({href:'#',
				className:'icon_link', 
				onClick:this.toggleUnlock},[
				DOM.svg({className:'icon'},[
					DOM.use({'xlink:href':"/sprite.svg#lock-locked"})
				])
			])]);

		var keys = obj.index(1);
		if (!keys) {
			this.form = DOM.form({
				onSubmit: this.handleEncrypt,
				className:"content pure-form pure-form-stacked",
				spellcheck: false,
			}, [
				DOM.h2({},"New Encrypted Section"),
				
				DOM.div({className:"pure-g"},[
					DOM.textarea({name:"key", className:"pure-u-1",placeholder:"PGP Private Key (Paste)", value:""})]),
				DOM.div({className:"pure-g"},[
					DOM.input({name:"passphrase", className:"pure-u-1",type:'password', placeholder:"Passphrase (Optional)", value:""})]),
				DOM.div({className:"pure-g"},[DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Encrypt")]),
			]);
			return DOM.div(props, [
				toggle,this.form]);
		} else {
			var inner = [toggle, Keys({keys:keys, title:'Encrypted By:'})]
			if (this.state.showUnlockForm) {
				this.form = this.form = DOM.form({
					onSubmit: this.handleUnlock,
					className:"content pure-form pure-form-stacked",
					spellcheck: false,
				}, [
					DOM.h2({},"Unlock"),
					
					DOM.div({className:"pure-g"},[
						DOM.textarea({name:"key", className:"pure-u-1",placeholder:"PGP Private Key (Paste)", value:""})]),
					DOM.div({className:"pure-g"},[
						DOM.input({name:"passphrase", className:"pure-u-1",type:'password', placeholder:"Passphrase (Optional)", value:""})]),
					DOM.div({className:"pure-g"},[DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Unlock")]),
				]);
				inner.push(this.form);
			}
			return DOM.div(props, inner);
		}
		
	}
});

var Encrypt = createClass({
	toggleShare: function(e) {
		this.setState({showKeys:(!this.state.showKeys)});
		e.preventDefault();
		e.stopPropagation();
	},
	handleShare: function(e) {
		e.preventDefault(); //don't submit form
		e.stopPropagation();
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.shareForm.node;
		var akey = form.key.value;
		var pub = context.importKey(akey);
		if (pub && !(pub.isPrivate())) {
			new_share_key(context, editor, pub, this.props.obj.id);
			this.setState({showKeys:false});
		}

	},
	render: function() {
		var obj = this.props.obj;
		var editor = this.props.editor;
		var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
		var props = {
			id: keyToId(obj.id),
			className: 'encrypted',
			
		};
		var children = obj.tail();
		if (children.length === 0) children = ["\u00A0"];
		var toggle = DOM.form({},[DOM.a({href:'#',
				className:'icon_link', 
				onClick:this.toggleShare},[
				DOM.svg({className:'icon'},[
					DOM.use({'xlink:href':"/sprite.svg#lock-unlocked"})
				])
			])]);
		this.shareForm = DOM.form({
			onSubmit: this.handleShare,
			className:"content pure-form pure-form-stacked shareForm",
			spellcheck: false}, [
				DOM.div({className:"pure-g"},[
					DOM.textarea({name:"key", className:"pure-u-1",placeholder:"Paste PGP Public Key to share", value:""}),
					DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Share")
				])
			]);
		var inner = [toggle];
		if (this.state.showKeys) {
			inner.push(Keys({keys:obj.index(1), title:'Encrypted By:'}));
			inner.push(this.shareForm);
		}
		inner.push(DOM.div({className:"content"}, 
			renderChildren(children, this.props.selection, obj.id, editor, path)));
		return DOM.div(props,inner);
	}
});

//register renderers
renderers.encrypted = Encrypted;
renderers.encrypt = Encrypt;
// must be here and not in the plugin load as the plugin load is after
// first render

var keymap = [
	{keys:["ctrl+alt+e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["cmd+n","e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["ctrl+e","s"], command:"squash_encrypted_ops"},
];

module.exports = function(editor) {
	//wrap context.
	var context = new EncryptedContext(editor.store().context, editor);
	editor.store().context = context;

	//(doc -> region -> (arg) -> op) -> selection -> ops
	function bySelection(f, selection, arg) {
		var doc = editor.document();
		var ops = [];
		var _selection = selection || editor.selection();
		function _replace(region) {
			var op = f(doc, region, arg);
			ops = ot.compose(ops, ot.transform(op,ops));
		}
		_selection.forEachR(_replace);
		return ops;
	}

	//this is the same as section break but with
	//the ability to insert things between the
	//sections
	function _insert_new(doc, region, between) {
		var as = doc.attributesAt(region.begin());
		var breaks = [];
		var ops = [];
		var a;
		for (var i = as.length - 1; i >= 0; i--) {
			var x = as[i];
			breaks.push(x);
			ops.push(ot.operations.pop);
			if (x.type === 'list' && x.node.head().sym === 'section') break;
		};
		if (x.node.head().sym !== 'section') return []; //could not find section to break;
		ops = ops.concat(between);
		while ((a = breaks.pop())) {
			if (a.type === 'list') {
				ops.push(ot.operations.pushA(a.attributes));
				ops.push(ot.operations.insert(a.node.head().sym,'sym'));
			} else {
				ops.push(ot.operations.pushS());
			}
		}
		return doc.replace(region, ops);
	}

	var NEW_ENC = new List();
	NEW_ENC.push(sym('encrypted'));

	function insert_new(args) {
		var between = NEW_ENC.prefix(0,NEW_ENC.size);
		var sel = editor.selection();
		if (sel.regions.length !== 1) return;
		var region = sel.regions[0];
		var doc = editor.document();
		var ops = _insert_new(doc, region, between);
		editor.apply(ops);
		//if we have a key decrypt the region
		var context = editor.store().context;
		//console.log('Default key')
		//console.log(context.defaultKey)
		if (context.defaultKey !== undefined) {
			var off = 0;
			for (var i = 0; i < ops.length; i++) {
				var op = ops[i];
				if (op.op === 'insert' &&
					op.type === 'sym' &&
					op.value === 'encrypted')
					break;
				switch (op.op) {
					case 'retain':
					case 'insert':
						off += op.n;
						break;
				}
			};
			var node = editor.document().nodeAt(off-1).node;
			//console.log(off)
			//console.log(node)
			if (!(node && node instanceof List &&
				node.head().sym === 'encrypted' &&
				node.values.length === 1)) return;
			new_encrypt_key(context, editor, context.defaultKey, node.id);
		}
	}
	insert_new.description = function(args) {
		return "Insert new encrypted section.";
	};

	function squash() {
		context.squash();
	}
	squash.description = function() {
		return "Squash encrypted ops";
	};

	return {
		commands: {
			insert_new_encrypted: insert_new,
			squash_encrypted_ops: squash,
		},
		keymap: keymap,
	};
}
