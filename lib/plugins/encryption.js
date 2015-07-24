/* Encryption plugin --- support encrypted sections of document */

var openpgp = require('openpgp');
var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var render = require('../render');
var renderChildren = render.renderChildren;
var renderers = render.renderers;

var ot = require('ot-sexpr');
var List = ot.List;
var AttributedString = ot.AttributedString;
var sym = ot.sym;
var Selection = ot.Selection;
var Region = ot.Region;

var keyToId = require('../ids').keyToId;

if (window && window.msCrypto) window.crypto = window.msCrypto;

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
		//calculate keys end and delta
		var keysize = this.index(1).size;
		var instructions = 0;
		//count all the children that look like instructions
		for (var i = this.values.length - 1; i >= 2; i--) {
			var child = this.values[i];
			if (typeof child === 'object' && child.r && child.iv && child.op)
				instructions++;
		};
		return (this._encryptRegions = [{
			id:this.id,
			start:(keysize + 2),
			end:(this.size - 1),
			delta:(this.size - 3 - keysize - instructions),
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
			start:(r.start + offset), //keys end
			end:(r.end + offset), //close of node .. where inserts go
			delta:r.delta, //total size of non encrypted stuff
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
	this.aesEnc = {}; //cache of aes enc instances
	//region to encrypt key...
	this.context = context;
	this._onOp = context._onOp;
	this._snapshot = context.getSnapshot();
	this.context._onOp = function(op) {
		//TODO: do something with the server op here

    	//note decrypt is 
    	//var msg = openpgp.message.readArmored(armored);
    	//msg = msg.decrypt(privateKey);
    	//return msg.getText();
    	var unenc_op = op;

    	this._snapshot = ot.apply(this._snapshot, unenc_op);
		if (this._onOp) this._onOp(unenc_op);
	}
}
EncryptedContext.prototype.getSnapshot = function() {
	return this._snapshot;
};
EncryptedContext.prototype.submitOp = function(op) {
	this._snapshot = ot.apply(this._snapshot, op);

	var regions = this._snapshot.encryptRegions();
	
	var enc_op = [];
	var offset = 0;
	//transform to offsets from end of keys
	for (var i=0;i<op.length;i++) {
		var o = op[i];
		//TODO: encrypt/tranform
		switch (o.op) {
			case 'retain':
			case 'delete':
				offset += o.n;
				break;
		}
		enc_op.push(o);
	}

	this.context.submitOp(enc_op);
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
	if (doDecryption) this._decryptSnapshot();
	return ret; //return the public key
};
EncryptedContext.prototype._decryptSnapshot = function(node) {
	node = node || this._snapshot;
	if (!node.containsEncrypted()) return;
	if (node.head().sym === 'encrypted') {
		this.decryptNode(node);
	} else {
		for (var i = 0; i < node.values.length; i++) {
			var child = node.values[i];
			if (child instanceof List)
				this._decryptSnapshot(child);
		}
	}
};
EncryptedContext.prototype._apply = function(op) {
	//apply ops to the local snapshot only
	this._snapshot = ot.apply(this._snapshot, op);
	if (this._onOp) this._onOp(op);
	//TODO: remove this line
	this.context.submitOp(op);
};
EncryptedContext.prototype.decryptNode = function(node) {
	console.log('decryptNode: ' + node.id);
	this._snapshot.parent = null;
	var keys = node.index(1);
	if (!keys) return -1; //this node doesn't have any keys yet
	var offset = node.offset();
	if (offset === -1) return -1;
	var aes = this.aesKeys[node.id];
	if (!aes) {
		//find matching key
		if (!keys) return -1; //doesn't have any keys yet
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
		aes = msg.getText();
		this.aesKeys[node.id] = aes;
	}
	console.log('Decrypting Node: ' + node.id)

	var ops = node.prefix(1,2,ot.operations.delete);
	ops.unshift(ot.operations.retain(offset + 1));
	ops.push(ot.operations.insert('encrypt','sym'));

	offset += 2 + node.size; //return offset after keys

	//TODO: decrypt ops after keys
	//ops = ops.concat(decryped ops)

	this._apply(ops);

	return offset;
};
EncryptedContext.prototype.squash = function() {
	//TODO
	//traverse document and replace all the encrypted ops with
	//new nonce and squash to single op by composition

	//TODO should probably also generate a new key at the same time.
};

/*

//ops are retain from start of the encrypted area. If they contain
// a sequence number then you can apply them in sequence.

(encrypted (keys {id:..., key:...}) ...ops...)
 -- where each op is {r:rev, iv:..., op:encryptedop}

(encrypt (keys {}) ... objects created by ops ...)

 -- sqauash

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

function new_encrypt_key(context, editor, pub, node) {
	editor.document().parent = null; //ensure parent null
	//generate aes secure key
	var aes = openpgp.crypto.random.getRandomBytes(32); //for aes256
	var apub = pub.armor();
	var keyid = pub.primaryKey.keyid.toHex()
	
	//pgp encrypt the aes key and store it on the document
	var msg = openpgp.message.fromText(aes);
    msg = msg.encrypt([pub]);
    var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    	msg.packets.write());
    //add key to encrypted region
    var new_keys = new List();
    new_keys.push(sym('keys'));
    new_keys.push({id:keyid ,public:apub, key:armored});
    var offset = node.offset();
    if (offset === -1)
    	throw "Cannot find node offet to encrypt.";
    //register key.
    context.aesKeys[node.id] = aes;
    //insert the keys.
    var ops = [ot.operations.retain(offset + 2)];
    ops = ops.concat(new_keys.prefix(0,new_keys.size));
    editor.apply(ops);
    //decrypt node
    node = editor.document().nodeAt(offset).node;
    context.decryptNode(node);
    //add new paragraph
    ops = [ot.operations.retain(offset + 2 + new_keys.size)];
    ops = ops.concat(NEW_P);
    var selection = new Selection([new Region(offset + 2 + new_keys.size + 3)]);
    editor.apply(ops, selection);
    editor.ensureFocus();
    editor.scrollToCursor();
}

function new_share_key(context, editor, pub, node) {
	editor.document().parent = null; //ensure parent null
	//get secret key
	var aes = context.aesKeys[node.id];
	if (!aes) return;
	var apub = pub.armor();
	var keyid = pub.primaryKey.keyid.toHex();

	var keys = node.index(1);
	var existing = keys.values.slice(1);
	if (existing.some(function(k) {
		return k.id === keyid;
	})) return; // already shared with key
	
	//pgp encrypt the aes key and store it on the document
	console.log("Sharing: " + aes);
	var msg = openpgp.message.fromText(aes);
	console.log("encrypt")
    msg = msg.encrypt([pub]);
    console.log('armor')
    var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    	msg.packets.write());
    //add key to encrypted region
    var new_key = {id:keyid ,public:apub, key:armored};
    var offset = node.offset();
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
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.form.node;
		var akey = form.key.value;
		var passphrase = form.passphrase.value;
		var pub = context.importKey(akey,passphrase);
		if (pub && !(pub.isPrivate()))
			new_encrypt_key(context, editor, pub, this.props.obj);
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
					DOM.use({'xlink:href':"sprite.svg#lock-locked"})
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
			new_share_key(context, editor, pub, this.props.obj);
			this.setState({showKeys:false});
		}

	},
	render: function() {
		var obj = this.props.obj;
		var editor = this.props.editor;
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
					DOM.use({'xlink:href':"sprite.svg#lock-unlocked"})
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
			renderChildren(children, this.props.selection, obj.id, editor)));
		return DOM.div(props,inner);
	}
});

//register renderers
renderers.encrypted = Encrypted;
renderers.encrypt = Encrypt;
// must be here and not in the plugin load as the plugin load is after
// first render

var keymap = [
	{keys:["ctrl+i","e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["cmd+i","e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
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
		console.log('Default key')
		console.log(context.defaultKey)
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
			console.log(off)
			console.log(node)
			if (!(node && node instanceof List &&
				node.head().sym === 'encrypted' &&
				node.values.length === 1)) return;
			new_encrypt_key(context, editor, context.defaultKey, node);
		}
	}
	insert_new.description = function(args) {
		return "Insert new encrypted section."
	};

	return {
		commands: {
			insert_new_encrypted: insert_new,
		},
		keymap: keymap,
	};
}
module.exports.openpgp = openpgp;
