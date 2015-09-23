//Render the document content to a DOM node
// and handle document/window events

var render = require('./render');
var Preview = render.Preview;

var ottype = require('ot-sexpr');

var friar = require('friar');
var Region = ottype.Region;
var Selection = ottype.Selection;
var sym = ottype.sym;

var ids = require('./ids');
var keyToId = ids.keyToId;
var idToKey = ids.idToKey;

var List = ottype.List;
var AttributedString = ottype.AttributedString;


var TEXT_CONTENT = {
	'#text': true,
	'code': true,
	_fixup: function(children) {
		//TODO: should actually traverse and get all the
		// attribute strings as this will lose the attributes.
		var str = children.map(function(c) { return c.toText().replace(
			/\u0002|\u0091|\u0003|\u0098|\u009C/g,' '); }).join(' ');
		return [new AttributedString(str)]
	},
	_default: function() {
		return [new AttributedString("")];
	},
	_level: 2,
};

var VALID_DOC = {
	'doc': {
		'section':true,
		'encrypted':true,
		'encrypt':true,
		_fixup: function(children) { return [wrap('section',children)]; },
		_level: 0,
	},
	'section':{
		'p':true,
		'h1':true,
		'h2':true,
		'h3':true,
		'h4':true,
		'h5':true,
		'h6':true,
		'blockquote':true,
		'pullquote':true,
		'ulli':true,
		'olli':true,
		'table':true,
		'code':true,
		'result':true,
		_fixup: function(children) {
			//TODO: probably want to do something smarter here.
			//if child is section then we unwrap.
			return [wrap('p', children)]; 
		},
		_level: 1,
	},
	'encrypted': {
		'keys':true,
		'ops':true,
		_fixup: function(children) { return []; },
	},
	'keys': {
		'#obj':true,
		_fixup: function(children) { return []; },
	},
	'ops': {
		'#obj':true,
		_fixup: function(children) { return []; },
	},
	'p':TEXT_CONTENT,
	'h1':TEXT_CONTENT,
	'h2':TEXT_CONTENT,
	'h3':TEXT_CONTENT,
	'h4':TEXT_CONTENT,
	'h5':TEXT_CONTENT,
	'h6':TEXT_CONTENT,
	'blockquote':TEXT_CONTENT,
	'pullquote':TEXT_CONTENT,
	'ulli':TEXT_CONTENT,
	'olli':TEXT_CONTENT,
	'code': {
		'#text':true,
		_fixup: TEXT_CONTENT._fixup,
		_level: 2,
	},
	'cell':{
		'#text': true,
		'code': true,
		_fixup: TEXT_CONTENT._fixup,
		_default: function() {
			return [new AttributedString("")];
		},
		_level: 4,
	},
	'table': {
		'row':true,
		_fixup: function(children) { return [wrap('row', children)]; },
		_level: 2,
	},
	'row': {
		'cell':true,
		_fixup: function(children) { return [wrap('cell', children)]; },
		_level: 3,

	}
};

//take a document fragment and return a
//valid document fragment
function fixup(node) {
	if (!node) return node;
	if (node.type !== 'list') return node;
	var v = VALID_DOC[node.head().sym];

	var nn = new List(node.id, node.attributes);
	nn.push(node.head());
	for(var i = 1; i < node.values.length; i++) {
		var child = node.values[i];
		var name = _name(child);
		if (!v[name]) {
			var invalids = [];
			while (!v[name] && child) {
				invalids.push(child);
				i++;
				child = node.values[i];
				name = _name(child);
			}
			var _fus = v._fixup(invalids);
			for (var j = 0; j< _fus.length; j++)
				nn.push(fixup(_fus[j]));
		}
		if (child)
			nn.push(fixup(child));
	}
	return nn;
}

function _name(node) {
	if (!node) return '';
	if (node.type === 'string') return '#text';
	if (typeof node.head !== 'function') return '#obj';
	return node.head().sym;
}

function _containsElement(nodes) {
	for (var i = nodes.length - 1; i >= 0; i--) {
		var node = nodes[i];
		if (node.nodeType === 1) return true;
	};
	return false;
}

//parse html back into a doc type object
function htmlToDoc(html) {
	var elm = document.createElement('div');
	elm.innerHTML = html; //
	var nodes = elm.childNodes;
	if (_containsElement(nodes)) {
		var n_nodes = [];
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			if (node.nodeType === 1) n_nodes.push(node);
		};
		nodes = n_nodes;
	}
	var res = elemsToDoc(nodes,{},{});
	if (res.length > 1)
		res = wrap('doc',res);
	else
		res = res[0];
	if (res.type !== 'list' || res.head().sym !== 'doc')
		res = wrap('doc',[res]);
	return res;
}

function wrap(head, children, attribs) {
	var n = new List(null, attribs);
	var v = VALID_DOC[head];
	if (children.length === 0 && v._default)
		children = v._default();
	n.push(sym(head));
	//for (var i=0; i<children.length; i++)
	//	n.push(children[i]);
	for(var i=0; i < children.length; i++) {
		var child = children[i];
		var name = _name(child);
		if (!v[name]) {
			var invalids = [];
			while (!v[name] && child) {
				invalids.push(child);
				i++;
				child = children[i];
				name = _name(child);
			}
			var _fus = v._fixup(invalids);
			for (var j = 0; j< _fus.length; j++)
				n.push(fixup(_fus[j]));
		}
		if (child)
			n.push(child);
	}
	return n;
}

function elemsToDoc(nodes, attribs, state) {
	//should join up all the strings.
	var res = [];
	var as = false;
	for (var i=0;i<nodes.length;i++) {
		var ds = elemToDoc(nodes[i], attribs, state);
		for (var j=0;j<ds.length;j++) {
			var d = ds[j];
			if (as && d.type === 'string') {
				var r = res.pop();
				res.push(r.concat(d));
			} else {
				res.push(d);
				as = (d.type === 'string');
			}
		}
	}
	return res;
}

var VALID_DIV_CLASSNAMES = {
	'doc':true,
};
var IGNORE_DIV_CLASSNAMES = {
	//'result':true, //paste results as unwrapped
	'encrypted':true,
};

function elemToDoc(node, attribs, state) {
	if (node.nodeType === 3) {
		var str = node.nodeValue;
		if (/^\s+$/.test(str)) return [];
		var as = new AttributedString(str,[[str.length, objClone(attribs)]]);
		return [as];
	} else if (node.nodeType === 1) {
		var children;
		var nn = node.nodeName.toLowerCase();
		switch (nn) {
			case 'div':
				if (IGNORE_DIV_CLASSNAMES[node.className])
					return [];
				children = elemsToDoc(node.childNodes, attribs, state);
				if (VALID_DIV_CLASSNAMES[node.className])
					return [wrap(node.className,children)];
				if (node.className === 'encrypt')
					return [wrap('section', children)];
				return children; //don't wrap invalid divs
			case 'section':
			case 'h1':
			case 'h2':
			case 'h3':
			case 'h4':
			case 'h5':
			case 'h6':
			case 'p':
			case 'code':
				children = elemsToDoc(node.childNodes, attribs, state);
				return [wrap(nn,children)];
			case 'table':
				children = elemsToDoc(node.childNodes, attribs, state);
				//TODO: count the rows in the head section.
				var thead = node.getElementsByTagName('thead')[0];
				var attribs = {};
				if (thead && thead.childElementCount)
					attribs.headerRows = thead.childElementCount;
				else
					attribs.headerRows = 1;
				return [wrap('table',children, attribs)];
			case 'tr':
				children = elemsToDoc(node.childNodes, attribs, state);
				return [wrap('row',children)];
			case 'th':
			case 'td':
				children = elemsToDoc(node.childNodes, attribs, state);
				var as = {};
				if (node.colSpan && node.colSpan > 1)
					as.colSpan = node.colSpan;
				if (node.rowSpan && node.rowSpan > 1)
					as.rowSpan = node.rowSpan;
				return [wrap('cell',children, as)];
			case 'blockquote':
				var head = (node.className === 'pullquote') ? 'pullquote' : 'blockquote';
				children = elemsToDoc(node.childNodes, attribs, state);
				return [wrap(head,children)];
			case 'li':
				var lit = state.listType || 'ulli';
				children = elemsToDoc(node.childNodes, attribs, state);
				return [wrap(lit,children)];
			case 'ul':
				var s = objClone(state);
				s.listType = 'ulli';
				return elemsToDoc(node.childNodes, attribs, s);
			case 'ol':
				var s = objClone(state);
				s.listType = 'olli';
				return elemsToDoc(node.childNodes, attribs, s);
			case 'b':
			case 'i':
				nn = nn === 'b' ? 'strong' : 'em';
				//fall through
			case 'strong':
			case 'em':
				var a = objClone(attribs);
				a[nn] = true;
				return elemsToDoc(node.childNodes, a, state);
			case 'span':
				var a = attribs;
				if (node.style.textDecoration === 'underline') {
					a = objClone(attribs);
					a.underline = true;
				}
				return elemsToDoc(node.childNodes, a, state);
			case 'input':
			case 'form':
			case 'button':
			case 'meta':
			case 'link':
			case 'script':
			case 'colgroup':
			case 'col':
			case 'style':
			case 'textarea':
			case 'option':
			case 'fieldset':
			case 'legend':
			case 'canvas':
			case 'nav':
			case 'base':
			case 'object':
			case 'embed':
			case 'noscript':
			case 'param':
			case 'head':
				return []; //ignore tags
			default:
				//by default just return the children unwrapped
				return elemsToDoc(node.childNodes, attribs, state);

		}
	} else {
		return [];
	}
}

function objClone(obj) {
	var ret = {};
	for (var k in obj)
		if (obj.hasOwnProperty(k))
			ret[k] = obj[k];
	return ret;
}

//generate a str representation for easy traversal
// of just the text
List.prototype.toText = function() {
	if (this._str) return this._str;
	this._str = '\u0002' + this.values.map(function(v) {
		if (typeof v.toText === 'function')
			return v.toText();
		return '\u0091'; //all atoms and symbols are this.
	}).join('') + '\u0003'; //end of text
	return this._str;
};
AttributedString.prototype.toText = function() {
	if (this._str) return this._str;
		this._str = '\u0098' + this.str + '\u009C';
	return this._str;
};

//Keep document valid only
List.prototype._push = List.prototype.push;
List.prototype.push = function(v) {
	var head = this.head();
	if (!head) return this._push(v); //no head yet
	var valid = VALID_DOC[head.sym];
	if (!valid) return this._push(v); //no validity check for head
	var name = _name(v);
	if (valid[name]) return this._push(v); //valid child
	throw('ERROR: should not put ' + name + ' in '+head.sym);
	//return this._push(v);
}

//var actions = require('./actions');

var createClass = friar.createClass;
var DOM         = friar.DOM;


var reKey = /^clay:/;
var reKeyIndexOffsetCursor = /^clay:([^:]+):(\d+):(\d+)_.+/;
var reKeyIndexOffset = /^clay:([^:]+):(\d+):(\d+)/;
var reClay = /clay:/;

var reText = /[^\u0002\u0003\u0091\u0098]/g;
var reNotText = /[\u0002\u0003\u0091\u0098]/g; //don't include string term 9c so we match it
var reEndOfText = /\u009C/g;

//NOTE, word boundaries are characters so we can reverse the string
// and search backwards
var word_separators = "./\\()\"'-:,.;<>~!@#$%^&*|+=[]{}`~?";

RegExp.escape = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
var esc_word_separators = RegExp.escape(word_separators);

//use 'g' flag so we can set lastIndex rather than slice the string
// we still need to reverse the string for a backwards search
var reWordSeparator = new RegExp("[" + esc_word_separators + "\\s\u0002\u0003\u0091\u0098\u009C]", 'g');
var reSubWordSeparator = new RegExp("[" + esc_word_separators + "A-Z\\s\u0002\u0003\u0091\u0098\u009C]", 'g');
var reNotWordSeparator = new RegExp("[^" + esc_word_separators + "\\s\u0002\u0003\u0091\u0098\u009C]", 'g');
var reNotSubWordSeparator = new RegExp("[^" + esc_word_separators + "A-Z\\s\u0002\u0003\u0091\u0098\u009C]", 'g');



var keyNames = {
	3: "enter", 8: "backspace", 9: "tab", 
	13: "enter", 16: "shift", 17: "ctrl", 
	18: "alt", 19: "pause", 20: "capslock", 
	27: "esc", 32: "space", 33: "pageup", 
	34: "pagedown", 35: "end",36: "home", 
	37: "left", 38: "up", 39: "right", 
	40: "down", 44: "printscrn", 45: "insert",
    46: "delete", 59: ";", 61: "=", 
    91: "mod", 92: "mod", 93: "mod", 
    107: "=", 109: "-", 127: "delete",
    173: "-", 186: ";", 187: "=", 
    188: ",", 189: "-", 190: ".", 
    191: "/", 192: "`", 219: "[", 
    220: "\\", 221: "]", 222: "'", 
    223: "`",
    63232: "up", 63233: "down", 63234: "left", 
    63235: "right", 63272: "delete", 63273: "home", 
    63275: "end", 63276: "pageup", 63277: "pagedown", 
    63302: "insert"
};
(function() {
    // Number keys
    for (var i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i);
    // Alphabetic keys
    for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i);
    // Function keys
    for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i;
})();

var keyName = function(event) {
    var base = keyNames[event.keyCode], name = base;
    if (name == null || event.altGraphKey) return false;
    if (event.shiftKey && base != "shift") name = "shift+" + name;
    if (event.altKey && base != "alt") name = "alt+" + name;
    if (event.ctrlKey && base != "ctrl") name = "ctrl+" + name;
    if (event.metaKey && base != "cmd") name = "cmd+" + name;
    return name;
};


//make breakables/can_restyle
["p","h1","h2","h3","h4","h5","h6"
,"code","ulli","olli","blockquote","pullquote"
].forEach(function(x) {
	var s = sym(x);
	s.breakable = true;
	s.can_restyle = true;
});


function isChildOf(node, ancestor) {
	var _node = node;
	while(_node) {
		if (_node === ancestor) return true;
		_node = _node.parentNode;
	}
	return false;
}

function last(a) { return a[a.length - 1]; }

function offsetFromPoint(textnode, x, y) {
	var len = textnode.length;
	if (len === 0) return 0;
	if (len === 1 && textnode.textContent === "\u200B") return 0;
	if (len === 1 && textnode.textContent === "\u00A0") return 0;
	var doc = textnode.ownerDocument;
	var range = doc.createRange();
	var rect;
	var rects;
	range.selectNode(textnode);
	rects = range.getClientRects();
	rect = range.getBoundingClientRect();
	var to = len;
	var from = 0;
	//console.log(rects)
	var dist = to - from;
	//find closest approach
	function closest(rects) {
		var minY = 1000000000;
		var minX = 1000000000;
		var after = false;
		for (var i = 0; i < rects.length; i++) {
			var r = rects[i];
			var dy = 0
			var dx = 0;
			if (y > r.bottom)
				dy = y - r.bottom;
			else if (y < r.top)
				dy = r.top - y;
			if (x > r.right)
				dx = x - r.right;
			else if (x < r.left)
				dx = r.left - x;
			if (dy < minY || (dy === minY && dx < minX)) {
				minY = dy;
				minX = dx;
				if (i > 0 || (x > (r.left + r.right) / 2))
					after = true;
				else
					after = false;
			}
		}
		return {x:minX, y:minY, after:after};
	}
	var target = closest(rects);
	var clo = target;
	//binary search
	for (;;) {
		if (to - from <= 1) {
			var ret = clo.after ? to : from;
			//console.log("returning: " + ret);
			return ret;
		}
		var step = Math.ceil(dist / 2);
		var middle = from + step;
		range.setStart(textnode, from);
		range.setEnd(textnode, middle);
		rects = range.getClientRects();
		clo = closest(rects);
		if (clo.y > target.y ||
			(clo.y === target.y && clo.x > target.x)) {
			//other half.
			from = middle;
			dist -= step;
			clo.after = true;
		} else {
			//this half.
			to = middle;
			dist = step;
		}
	}
}

function getClientRectsForTextNode(textnode) {
	var doc = textnode.ownerDocument;
	var range = doc.createRange();
	range.selectNode(textnode);
	return range.getClientRects();
}

function rangesForSelection(doc, sel) {
	var st = sel.start();
	var en = sel.end();
	var ret = [];
	doc.selectedNodes(st, en).forEach(function(n) {
		var range = document.createRange();
		var e = document.getElementById(keyToId(n.node.id));
		if (e === null) return;
		if (n.start === undefined && e) {
			range.selectNode(e);
			ret.push(range);
			return;
		}
		//TODO: partial select here.
	});
	return ret;
}

var CONTEXT_REQUIRES_REGION = {
	head: true,
	preceding_text: true,
};

var CONTEXT_OPS = {
	'equals': function(value, operand) {
		return (value == operand);
	},
	'in': function(value, operand) {
		for (var i = 0; i < operand.length; i++) {
			if (value == operand[i]) return true;
		};
		return false;
	},
};

var isSafari = navigator.appVersion.search('Safari') != -1 && navigator.appVersion.search('Chrome') == -1 && navigator.appVersion.search('CrMo') == -1 && navigator.appVersion.search('CriOS') == -1;
var isIe = (navigator.userAgent.toLowerCase().indexOf("msie") != -1 || navigator.userAgent.toLowerCase().indexOf("trident") != -1);

var Editor = createClass({
	validDoc: function() {
		return VALID_DOC;
	},
	getInitialState: function() {
		//plugins are loaded into these properties
		this.commands = {};
		this.state = {}; //dummy state
		this.keymap = {}; //matches on all keys in sequence. (only runs if all match)
		this.menu = [];
		this.context_menu = [];

		this.prevInput = '';
		this.focused = false;
		this.poll_id = null;
		this.cursor = null; //TODO: put some of this in state.
		this.top = 0;
		this.shouldCompose = false;
		this.lastAction = null;

		var store = this.props.store;

		this.plugins = [];
		if (this.props.plugins) {
			var plugins = this.props.plugins;
			for (var i=0; i < plugins.length; i++)
				this.plugins.push(this.readPlugin(plugins[i]));
		}

		return {
			doc: store.document(),
			selection: store.selection,
			key_sequence: [], //stores the currently pressed key sequence
			//zoom: 0, //TODO: allow zooming into a node and only displaying that.
		};
	},
	readPlugin: function(_plugin) {
		//last command wins
		var plugin = _plugin(this);
		if (plugin.commands) {
			var commands = plugin.commands;
			for (var k in commands) {
				if (!commands.hasOwnProperty(k))
					continue;
				this.commands[k] = commands[k];
			}
		}
		//keymaps matched backwards.
		if (plugin.keymap) {
			var keymap = plugin.keymap;
			for (var i = 0; i < keymap.length; i++) {
				var keyx = keymap[i];
				for (var j = 0; j < keyx.keys.length; j++) {
					var chord = keyx.keys[j].toLowerCase();
					if (!this.keymap.hasOwnProperty(chord))
						this.keymap[chord] = [];
					//TODO: might want to compile the context
					// if this is slow.
					this.keymap[chord].push(keyx);
				}
			}
		}
		if (plugin.menu) {
			//TODO: match on ids.
			this.menu = this.menu.concat(plugin.menu);
		}
		if (plugin.context_menu) {
			this.context_menu = this.context_menu.concat(plugin.context_menu);
		}

		return plugin;
	},
 	loadPlugin: function(plugin) {
		//add events
		var store = this.props.store
		for (var k in plugin) if (/^on/.test(k))
			store.on(k.slice(2), plugin[k]);
	},
	unloadPlugin: function(plugin) {
		//remove events
		var store = this.props.store
		for (var k in plugin) if (/^on/.test(k))
			store.removeListener(k.slice(2), plugin[k]);
	},
	didMount: function() {
		//register the
		if (this.plugins) {
			var plugins = this.plugins;
			for (var i=0; i < plugins.length; i++)
				this.loadPlugin(plugins[i]);
		}

		setTimeout(this.ensureFocus, 20);
		this.props.store.on('change', this._onChange);
		var ta = this.textarea.node;
		var pa = this.hiddenPasteArea.node;
		if (isIe) {
			ta.addEventListener('beforepaste', this.focusPasteDiv);
			pa.addEventListener('paste', this.handlePaste);
		}
		ta.addEventListener('paste', this.handlePaste);
		ta.addEventListener('cut', this.handleCut);
		ta.addEventListener('copy', this.handleCopy);
		document.body.addEventListener('mouseup', this.handleBodyMouseUp);
		document.body.addEventListener('mousemove', this.handleBodyMouseMove);
		//setTimeout(this.updateCursors,0);
	},
	willUnmount: function() {

		if (this.plugins) {
			var plugins = this.plugins;
			for (var i=0; i < plugins.length; i++)
				this.unloadPlugin(plugins[i]);
		}

		this.focused = false;
		var ta = this.textarea.node;
		this.props.store.removeListener('change', this._onChange);
		if (isIe) {
			ta.removeEventListener('beforepaste', this.focusPasteDiv);
			pa.removeEventListener('paste', this.handlePaste);
		}
		ta.removeEventListener('paste', this.handlePaste);
		ta.removeEventListener('cut', this.handleCut);
		ta.removeEventListener('copy', this.handleCopy);
		document.body.removeEventListener('mouseup', this.handleBodyMouseUp);
		document.body.removeEventListener('mousemove', this.handleBodyMouseMove);
	},
	readInput: function() {
		//bail if we can 
		//else
		var input = this.textarea.node;
		var text = input.value;
		var prevInput = this.prevInput;
		if (text === prevInput) return false;
		if (prevInput.charAt(0) === "\u200B")
			prevInput = prevInput.slice(1);
		if (text.charAt(0) === "\u200B")
			text = text.slice(1);
		//find input diff
		var i = 0; l = Math.min(prevInput.length, text.length);
		while (i < l && prevInput.charCodeAt(i) === text.charCodeAt(i)) ++i;
		var inserted = text.slice(i);
		var offset = 0;
		if (i < prevInput.length) {
			//delete some characters
			offset = -(prevInput.length - i);
		};
		this.props.store.replaceText(null, offset, inserted, null, this.lastAction === 'typing');
		this.shouldCompose = true;
		this.lastAction	= 'typing';

		if (text.length > 1000 || /[\n ]/.test(text)) {
			input.value = this.prevInput = ""; //empty if long
		} else {
			this.prevInput = input.value;
		}
	},
	ensureFocus: function() {	
		var ta = this.textarea.node;
		if (this.state.selection.regions.every(function(r) { return r.empty(); })) {
			//
			ta.select();
			ta.selectionStart = ta.selectionEnd;
		} else {
			this.readInput();
			ta.value = this.prevInput = "\u200B";
			ta.select();
		}
		ta.focus();
	},
	poll: function() {
		clearTimeout(this.poll_id);
		this.readInput();
		if (this.focused) {
			this.poll_id = setTimeout(this.poll, 100);
		}
	},
	handleKeyPress: function(e) {
		//handle or fastPoll
		//handleCharBinding
	},
	context: function(key, region) {
		switch (key) {
			case "head":
				var n = this.state.doc.nodeAt(region.focus);
				n = (n.type !== 'list') ? n.parent : n.node;
				return n.head().sym;
			case "preceding_text":
				var n = this.state.doc.nodeAt(region.begin());
				//TODO: check we have string
				return n.node.str.slice(0,n.index);
			case "following_text":
				var n = this.state.doc.nodeAt(region.begin());
				//TODO: check we have string
				return n.node.str.slice(n.index);
			case "surrounding_text":
				var n = this.state.doc.nodeAt(region.begin());
				//TODO: check we have string
				return n.node.str;
			case "selection_empty":
				return region.empty();
			case "breakable":
				var n = this.state.doc.nodeAt(region.focus);
				n = (n.type !== 'list') ? n.parent : n.node;
				return !!n.head().breakable;
			default:
				return "";
		}
	},
	_checkContexts: function(contexts) {
		for (var i = 0; i < contexts.length; i++) {
			var context = contexts[i];
			var regions = this.state.selection.regions;
			if (!context.match_all)
				regions = regions.slice(regions.length-1);
			if (CONTEXT_REQUIRES_REGION[context.key] && regions.length === 0)
				return false;
			var op = CONTEXT_OPS[context.operator];
			for (var j = regions.length - 1; j >= 0; j--) {
				var r = regions[j];
				var val = this.context(context.key, r);
				if (!op(val, context.operand)) return false;
			};
		};
		return true;
	},
	match: function(name, args) {
		var shortcuts = this.keymap[name];
		var matched = false;
		if (shortcuts) {
			//match backwards against the possible shortcuts
			for (var i = shortcuts.length - 1; i >= 0 && !matched; i--) {
				var shortcut = shortcuts[i];
				//check previous
				var index = (this.state.key_sequence || []).length;
				if (name !== shortcut.keys[index]) continue;
				var seq_match = true;
				for (var j = 0; j < index; j++)
					if (shortcut.keys[j] !== this.state.key_sequence[j])
						seq_match = false;
				if (!seq_match) continue;
				//check contexts
				if (shortcut.context && !this._checkContexts(shortcut.context))
					continue;

				if (index + 1 === shortcut.keys.length) {
					this.run_command(shortcut.command, shortcut.args || args);
				} else {
					var nks = this.state.key_sequence.concat([name]);
					this.setState({key_sequence:nks});
				}
				matched = true;
			};
		}
		return matched;
	},
	handleKeyDown: function(e) {
		//ensureFocus
		//handleKeyBinding
		var name = keyName(e);
		if (name === false) return;
		name = name.toLowerCase();
		var matched = this.match(name);

		if (matched) {
			e.preventDefault();
		} else if (this.state.key_sequence && this.state.key_sequence.length > 0) {
			//no match so clear key sequence.
			this.setState({key_sequence:[]});
			this.ensureFocus();
		} else {
			this.ensureFocus();
			if (!(/^(cmd|ctrl|alt|shift|super)/).test(name))
				this.scrollToCursor(); //ensure a cursor is in view
		}
	},
	handleKeyUp: function(e) {
		//change shift status
		this.poll(); //fast poll once.
		this.ensureFocus();
	},
	handleChange: function(e) {
		this.poll(); //fast poll once.
	},
	handleInput: function(e) {
		this.poll(); //fast poll once.
	},
	handleFocus: function(e) {
		console.log('focus');
		//slowpoll
		//set selection state
		if (!this.focused) {
			this.focused = true;
			this.poll();
			this.updateCursors();
		}
	},
	handleBlur: function(e) {
		console.log('blur');
		if (this.focused) {
			this.shouldCompose = false;
			this.focused = false;
			this.updateCursors();
		}
	},
	text_to_window: function(point) {
		var doc = this.document();
		var root = this.node.ownerDocument;
		var n = doc.nodeAt(point);
		var r;
		if (n.type === 'string') {
			//TODO: find an id for the span.
			var chunks = n.node.chunk();
			var offset = 1;
			var target = n.offset; ///? +1
			var start_of_string = point - target;
			//find the correct chunk.
			var s = 0;
			for (var i=0; i < chunks.length; i++) {
				s = chunks[i].str.length;
				if (target >= offset && target < offset + s)
					break;
				offset += s;
			}
			if (offset >= n.node.length)
				offset -= s;
			//find the index of the string in parent
			var ind = n.parent.values.indexOf(n.node);
			//find the subselection and correct chunk offset
			var remainder = target - offset;
			var coff = start_of_string + offset;
			var subsel = this.selection().slice(coff, coff + s);
			var regions = subsel.regions;
			var noff = offset;
			for (var i=0; i < regions.length; i++) {
				var region = regions[i];
				var beg = region.begin();
				if (region.focus === remainder) {
					var key = keyToId(n.parent.id) + ':' + ind + ':' + 
						(offset + region.focus) + '_cursor';
					var elm = root.getElementById(key);
					if (elm) {
						var r = elm.getBoundingClientRect();
						break;
					}
				}
				if (beg > remainder) break;
				var end = region.end();
				if (end < remainder)
					noff = offset + end;
				else
					noff = offset + beg;
			}
			if (!r) {
				//create the id.
				var key = keyToId(n.parent.id) + ':' + ind + ':' + noff;
				//console.log(key);
				var x = root.getElementById(key);
				if (!x) throw "Cannot find sub string span: " + key;
				var range = root.createRange();
				//select offset in substring (target - offset)
				remainder = Math.max(0,target - noff);
				//console.log(target, noff)
				//console.log(remainder)
				//console.log(x);
				range.setStart(x.firstChild, 0);
				if (remainder > x.textContent.length)
					range.setEndAfter(x.firstChild);
				else
					range.setEnd(x.firstChild, remainder);
				//we don't get any rects for collapsed range
				//console.log(range)
				if (range.collapsed)
					range.setStartBefore(x.firstChild);
				rs = range.getClientRects();
				if (rs.length === 0) throw "Cannot find points position";
				var rect = rs[rs.length-1];
				r = {left: rect.right, right: rect.right,
					top: rect.top, bottom: rect.bottom, 
					height: rect.bottom - rect.top,
					width: 0};
				//console.log(JSON.stringify(r));
			}
		} else if (n.type === 'list') {
			var x = root.getElementById(keyToId(n.node.id));
			var rs = x.getClientRects();
			if (rs.length === 0) throw "Cannot find points position";
			r = rs[0];
		} else {
			//atom of some sort - return parent position
			var x = root.getElementById(keyToId(n.parent.id));
			var rs = x.getClientRects();
			if (rs.length === 0) throw "Cannot find points position";
			r = rs[0];
		}
		r.clientY = (r.top + r.bottom) / 2;
		r.clientX = (r.left + r.right) / 2;
		return r;
	},
	window_to_text: function(v) {
		//TODO.. this seems to fail if we fall off the bottom.
		var x = v.clientX;
		var y = v.clientY;
		var elm = this.preview.node;
		var doc = this.state.doc;
		var point = 0;
		var m;
		while (elm) {
			if (elm.nodeType === 3) {
				var off = offsetFromPoint(elm, x, y);
				//console.log(off)
				//console.log(point)
				return point + off;
			}
			if (elm.id) {
				//console.log(elm.id)
				if (reKey.test(elm.id)) {
					if ((m=reKeyIndexOffsetCursor.exec(elm.id))) {
						var a = doc.nodeByIndex(parseInt(m[2]));
						if (a) {
							doc = a.node;
							point += a.offset + parseInt(m[3]);
							return point; //at the cursor
						}
					} else if ((m=reKeyIndexOffset.exec(elm.id))) {
						var a = doc.nodeByIndex(parseInt(m[2]));
						if (a) {
							doc = a.node;
							point += a.offset + parseInt(m[3]);
						}
					} else {
						var a = doc.nodeById(idToKey(elm.id));
						if (a) {
							doc = a.node;
							point += a.offset;
						}
					}
				}
			}
			var nodes = elm.childNodes;
			var best_x = 1000000;
			var best_y = 1000000;
			elm = false;
			for (var i = 0; i < nodes.length; i++) {
				var node = nodes[i];
				var rects = [];
				if (node.nodeType === 3) {
					rects = getClientRectsForTextNode(node);
				} else if (typeof node.getClientRects === 'function') {
					rects = node.getClientRects();
				}
				for (var j = rects.length - 1; j >= 0; j--) {
					var r = rects[j];
					var yoff = 0;
					var xoff = 0;
					if (y < r.top)
						yoff = r.top - y;
					else if (y > r.bottom)
						yoff = y - r.bottom;
					if (x < r.left)
						xoff = r.left - x;
					else if (x > r.right)
						xoff = x - r.right;
					if (yoff < best_y || (yoff === best_y && xoff < best_x)) {
						best_x = xoff;
						best_y = yoff;
						elm = node;
					}
				};
			};
		}
		return point;
	},
	testRoundTripCursor: function(point) {
		//see if the point
		var v = this.text_to_window(point);
		var p = this.window_to_text(v);
		if (p !== point) {
			console.log("Point: " + point + " became " + p);
			var w = this.text_to_window(p);
			console.log(v)
			console.log(w)
		}
	},
	testAllRoundTripCursor: function() {
		var s = this.document().toText()
		var bof = s.indexOf('\u0098') + 1;
		var eof = s.lastIndexOf('\u009C');
		var p = bof;
		while (p <= eof) {
			try {
				this.testRoundTripCursor(p);
			} catch(e) {
				console.log(e);
				console.log(p);
			}
			//step f
			p++;
			while (!reText.test(s[p]) && p <= eof)
				p++;

		}
	},
	run_command: function(string, args) {
		//TODO: start editing state?
		var cmd = this.commands[string];
		if (typeof cmd.description === 'function')
			console.log(cmd.description(args));
		//console.log(JSON.stringify(this.selection()));
		return cmd(args);
		//console.log(this.document().toSexpr());
		//end editing state.
	},
	handleMouseDown: function(e) {
		if (e.target.form) return; //let form elements handle themselves
		console.log('editor: handleMouseDown')
		if (e.target.nodeName === "A" && e.ctrlKey) return; //ctrl click link
		if (e.ctrlKey || e.metaKey)
			this.merge_selection = this.state.selection;
		else
			this.merge_selection = new Selection();
		this.mouseDown = true;
		this.lastAction	= 'mouseDown';
		var point = this.window_to_text(e);
		if (this.state.key_sequence && this.state.key_sequence.length > 0)
			this.setState({key_sequence:[]});
		this.anchor = point;
		var r = new Region(point);
		if (e.detail === 2) {
			//double click - select word
			r = this.move(r,'words',1,false,false);
			r = this.move(r,'word_ends',1,true,true);
		} else if (e.detail === 3) {
			//tripple click - select paragraph
			console.log('tripple click')
			r = this.moveTo(r,'hardbol',false);
			r = this.moveTo(r,'hardeol',true);
		}
		this.props.store.select(this.merge_selection.add(r));
		e.preventDefault();
		e.stopPropagation();
		return false;
	},
	handleClick: function(e) {
		if (e.target.form) return; //let form elements handle themselves
		if (e.target.nodeName === "A" && e.ctrlKey) return; //ctrl click link
		e.preventDefault();
	},
	handleBodyMouseUp: function(e) {
		if (this.mouseDown) {
			console.log('body mouse up');
			this.mouseDown = false;
			var point = this.window_to_text(e);
			var r = new Region(point,this.anchor || point);
			if (e.detail === 2) {
				//double click - select word
				r = this.move(r,'words',1,false,false);
				r = this.move(r,'word_ends',1,true,true);
			} else if (e.detail === 3) {
				//tripple click - select paragraph
				console.log('tripple click')
				r = this.moveTo(r,'hardbol',false);
				r = this.moveTo(r,'hardeol',true);
			}
			this.props.store.select(this.merge_selection.add(r));
			var ebr = this.node.getBoundingClientRect();
			var scrollTop = -ebr.top;
			//var scrollTop = this.node.ownerDocument.body.scrollTop;
			var ta  =this.textarea.node;
			ta.style.top = (e.clientY + scrollTop) + 'px';
			e.preventDefault();
			this.ensureFocus();
		};
	},
	handleMouseUp: function(e) {
		console.log('mouse up');
		if (this.mouseDown) {
			this.mouseDown = false;
			var point = this.window_to_text(e);
			var ebr = this.node.getBoundingClientRect();
			var scrollTop = -ebr.top;
			//var scrollTop = this.node.ownerDocument.body.scrollTop;
			var ta  =this.textarea.node;
			ta.style.top = (e.clientY + scrollTop) + 'px';
			var r = new Region(point,this.anchor || point);
			if (e.detail === 2) {
				//double click - select word
				r = this.move(r,'words',1,false,false);
				r = this.move(r,'word_ends',1,true,true);
			} else if (e.detail === 3) {
				//tripple click - select paragraph
				console.log('tripple click')
				r = this.moveTo(r,'hardbol',false);
				r = this.moveTo(r,'hardeol',true);
			}
			this.props.store.select(this.merge_selection.add(r));
			e.preventDefault();
			this.ensureFocus();
		};
	},
	handleBodyMouseMove: function(e) {
		if (this.mouseDown) {
			var point = this.window_to_text(e);
			this.props.store.select(
				this.merge_selection.add(new Region(point,this.anchor || point)));
			e.preventDefault();
		};
	},
	updateCursors: function() {

	},
	//region -> string -> int -> bool -> region
	move: function(region, by, amount, forward, extend) {
		if (!amount) amount = 1;
		var amount = Math.abs(amount);
		var point = region.focus;
		var xpos = region.xpos;
		var doc = this.document();
		//by in characters, words, word_ends,
		// subwords, subword_ends, 
		// lines, wholelines, pages

		//idea: convert the sexpr into a string
		switch (by) {
			case 'characters':
				//move to next text character
				if (forward) {
					var s = doc.toText();
					reText.lastIndex = point + 1;
					var i = amount;
					var m;
					while (i > 0 && (m = reText.exec(s))) {
						point = m.index;
						i--;
					}
				} else {
					var s = doc.toText().split('').reverse().join('');
					reText.lastIndex = s.length - point;
					var i = amount;
					var m;
					while (i > 0 && (m = reText.exec(s))) {
						point = s.length - (m.index || 0) - 1;
						i--;
					}
				}
				break;
			case 'words':
				//move to the word beginning
				if (forward) {
					//find next wordSeparator.
					//Then next nonWordSeparator
					var s = doc.toText();
					reWordSeparator.lastIndex = point + 1;
					var i = amount;
					var m;
					while (i > 0 && (m = reWordSeparator.exec(s))) {
						point = m.index;
						reNotWordSeparator.lastIndex = point + 1;
						m = reNotWordSeparator.exec(s);
						if (!m) break;
						point = m.index;
						i--;
					}
				} else {
					var s = doc.toText().split('').reverse().join('');
					reNotWordSeparator.lastIndex = s.length - point;
					var i = amount;
					var m;
					while (i > 0 && (m = reNotWordSeparator.exec(s))) {
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						reWordSeparator.lastIndex = m.index + 1;
						m = reWordSeparator.exec(s);
						if (!m) break;
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						i--;
						reWordSeparator.lastIndex = m.index + 1;
					}
				}
				break;
			case 'word_ends':
				//move to next word end
				if (forward) {
					var s = doc.toText();
					reNotWordSeparator.lastIndex = point + 1;
					var i = amount;
					var m;
					while (i > 0 && (m = reNotWordSeparator.exec(s))) {
						point = m.index;
						reWordSeparator.lastIndex = point + 1;
						m = reWordSeparator.exec(s);
						if (!m) break;
						point = m.index;
						i--;
						reNotWordSeparator.lastIndex = m.index + 1;
					}
				} else {
					var s = doc.toText().split('').reverse().join('');
					reWordSeparator.lastIndex = s.length - point + 1;//????
					var i = amount;
					var m;
					while (i > 0 && (m = reWordSeparator.exec(s))) {
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						reNotWordSeparator.lastIndex = m.index + 1;
						m = reNotWordSeparator.exec(s);
						if (!m) break;
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						i--;
						reWordSeparator.lastIndex = m.index + 1;
					}
				}
				break;
			case 'subwords':
				//move to the beginning of the next subWord
				//TODO: ... these are not working
				if (forward) {
					//find next wordSeparator.
					//Then next nonWordSeparator
					var s = doc.toText();
					reSubWordSeparator.lastIndex = point + 1;
					var i = amount;
					var m;
					while (i > 0 && (m = reSubWordSeparator.exec(s))) {
						point = m.index;
						//intentionally not reNotSubWordSeparator
						reNotWordSeparator.lastIndex = point; //intentionally not +1
						m = reNotWordSeparator.exec(s);
						if (!m) break;
						point = m.index;
						i--;
					}
				} else {
					//TODO
					var s = doc.toText().split('').reverse().join('');
					reNotWordSeparator.lastIndex = s.length - point + 1;//????
					var i = amount;
					var m;
					while (i > 0 && (m = reNotWordSeparator.exec(s))) {
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						reSubWordSeparator.lastIndex = m.index + 1;
						m = reSubWordSeparator.exec(s);
						if (!m) break;
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						i--;
					}
				}
				break;
			case 'subword_ends':
				//move to the end of the next subWord
				//TODO: ... these are not working
				if (forward) {
					//find next wordSeparator.
					//Then next nonWordSeparator
					var s = doc.toText();
					reSubWordSeparator.lastIndex = point + 1;
					var i = amount;
					var m;
					while (i > 0 && (m = reSubWordSeparator.exec(s))) {
						point = m.index;
						//intentionally not reNotSubWordSeparator
						reNotWordSeparator.lastIndex = point; //intentionally not +1
						m = reNotWordSeparator.exec(s);
						if (!m) break;
						point = m.index;
						i--;
					}
				} else {
					//TODO
					var s = doc.toText().split('').reverse().join('');
					reNotWordSeparator.lastIndex = s.length - point + 1;//????
					var i = amount;
					var m;
					while (i > 0 && (m = reNotWordSeparator.exec(s))) {
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						reSubWordSeparator.lastIndex = m.index + 1;
						m = reSubWordSeparator.exec(s);
						if (!m) break;
						point = s.length - (m.index || 0);
						if (m[0] === '\u009C') point--;
						i--;
					}
				}
				break;
			case 'lines':
				//move to next line
				var r = region;
				var v = this.text_to_window(point);
				if (!xpos)
					xpos = v.clientX;
				while (amount > 0) {
					if (forward) {
						var eol = this.moveTo(r,'eol');
						//move forward 1 char
						var nl = this.move(eol,'characters',1,true);
						var w = this.text_to_window(nl.focus);
						point = this.window_to_text({clientX:xpos, clientY:w.clientY});
						if (point < eol.focus) {
							point = eol.focus;
							break;
						}
					} else {
						//bol
						var bol = this.moveTo(r,'bol');
						//move backwards 1 char
						var nl = this.move(bol,'characters',1,false);
						var w = this.text_to_window(nl.focus);
						point = this.window_to_text({clientX:xpos, clientY:w.clientY});
						if (point > bol.focus) {
							point = bol.focus;
							break;
						}
					}
					amount--;
					r = new Region(point);
				}
				break;
			//case 'wholelines':
			//	//move to next paragraph
			//	break;
			case 'pages':
				//move by one screen height
				var v = this.text_to_window(point);
				if (xpos === undefined)
					xpos = v.clientX;
				var h = window.innerHeight * 0.9;
				var y = forward ? v.top + h : v.bottom - h;
				point = this.window_to_text({clientX:xpos, clientY:y});
				var s = doc.toText();
				break;
		}
		if (extend)
			return new Region(point, region.anchor, xpos);
		return new Region(point, point, xpos);
	},
	//region -> position -> extend -> region
	moveTo: function(region, position, extend) {
		//position in eol, bol, hardeol, hardbol, eof, bof
		var point = region.focus;
		var doc = this.document();
		var xpos;
		switch(position) {
			case 'eof':
				//find the last character position in the file.
				var s = doc.toText();
				var m = s.lastIndexOf('\u009C');
				if (m > 0) point = m;
				break;
			case 'bof':
				//find the first character position in the file.
				var s = doc.toText();
				var m = s.indexOf('\u0098');
				if (m > 0) point = m + 1;
				xpos = 0;
				break;
			case 'hardeol':
				//find the last character position in the current breakable
				var s = doc.toText();
				var m = s.indexOf('\u009C',point); //don't skip to the next
				if (m > 0) point = m;
				xpos = 1000000;
				break;
			case 'hardbol':
				//find the first character position in the current breakable
				var s = doc.toText();
				var m = s.lastIndexOf('\u0098',point-1);
				if (m > 0) point = m + 1;
				xpos = -1000000;
				break;
			case 'eol':
				var v = this.text_to_window(point);
				xpos = v.clientX = 1000000;
				point = this.window_to_text(v);
				break;
			case 'bol':
				var v = this.text_to_window(point);
				xpos = v.clientX = -1000000;
				point = this.window_to_text(v);
				break;
		}
		if (extend)
			return new Region(point, region.anchor, xpos);
		return new Region(point, point, xpos);
	},
	didUpdate: function() {
		setTimeout(this.updateCursors,0);
	},
    focusCopyDiv: function() {
        this.hiddenCopyArea.node.focus();
        var range = document.createRange();
        range.selectNodeContents((this.hiddenCopyArea.node));
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
	},
	focusPasteDiv: function() {
        this.hiddenPasteArea.node.focus();
        var range = document.createRange();
        range.selectNodeContents((this.hiddenPasteArea.node));
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    },
    ieClipboardEvent: function(clipboardEvent) {
        var me = this;
        this.lastAction = clipboardEvent;
        var clipboardData = window.clipboardData;
        if (clipboardEvent == 'cut' || clipboardEvent == 'copy') {
            clipboardData.setData('Text', this.hiddenCopyArea.node.innerText);
            //?? render html to?
            this.focusCopyDiv();
            setTimeout(this.ensureFocus, 0); //set focus back to textarea
        }
        if (clipboardEvent == 'paste') {
            var clipboardText = clipboardData.getData('Text');
            this.hiddenPasteArea.node.innerHTML = '';
            setTimeout(function() {
            	if (me.hiddenPasteArea.node.childElementCount > 0)
            		me.pasteHtml(me.hiddenPasteArea.node.innerHTML);
            	else
            		me.pasteText(clipboardText)
                me.hiddenPasteArea.node.innerHTML = '';
                me.ensureFocus();
            }, 0);
        }
	},
    clipboardEvent: function(clipboardEvent, event) {
        this.lastAction = clipboardEvent;
        var clipboardData = event.clipboardData; //might pass in window
        if (clipboardEvent == 'cut' || clipboardEvent == 'copy') {
            clipboardData.setData('text/plain', this.hiddenCopyArea.node.innerText);
            clipboardData.setData('text/html', this.hiddenCopyArea.node.innerHTML);
        }
        if (clipboardEvent == 'paste') {
        	var d = clipboardData.getData('text/html');
        	if (d)
        		this.pasteHtml(d);
        	else
        		this.pasteText(clipboardData.getData('text/plain'));
        }
	},
	pasteHtml: function(html) {
		console.log('Clipboard HTML: ' + html);
		var doc = htmlToDoc(html);
		console.log(doc.toSexpr());
		this.pasteDoc = doc;
		if (!this.match('paste', doc)) {
			console.log('could not paste html');
		}
	},
	pasteText: function(text) {
		console.log('Clipboard Plain Text: ' + text);
		//TODO: parse the text markdown styly
		var doc = new AttributedString(text);
		if (!this.match('paste', doc)) {
			console.log('could not paste text');
		}
		//this.props.store.replaceText(null, 0, text, null, false);
	},
	handleClipboardEvent: function(ce,e) {
		console.log(ce);
		if (isIe) {
			this.ieClipboardEvent(ce);
		} else {
			this.clipboardEvent(ce, e);
			this.ensureFocus();
			e.preventDefault();
		}
	},
	handleCut: function(e) {
		this.handleClipboardEvent('cut', e);
		this.props.store.replaceText(null, 0, '', null, false);
	},
	handleCopy: function(e) {
		this.handleClipboardEvent('copy', e);
	},
	handlePaste: function(e) {
		this.handleClipboardEvent('paste', e);
	},
	replace: function(ops) {
		//TODO
		console.log('replace...')
	},
	replaceText: function(str, selection, offset) {
		//TODO: factor out the offset stuff.
		//TODO: stop using the store method.
		var doc = this.document();
		var sel = selection || this.state.selection;
		var off = offset || 0;
		sel = new Selection(sel.regions.map(function(r) { 
			return new Region(r.begin() + off, r.end()); }));
		var ops = [];
		function _replace(region) {
			var op;
			if (region.empty())
				op = doc.insertText(region.focus, str, attributes);
			else
				op = doc.replaceText(region, str, attributes);
			ops = ot.compose(ops, ot.transform(op,ops));
		}
		sel.forEachR(_replace);
		this.apply(ops,null,compose);
	},
	render: function() {
		//Not allowed in react.
		//might need to use a timeout to clear
		//textArea after reload (ie sometimes restores content magic)
		this.textarea = DOM.textarea({
			//id: 'model', 
			className: 'hiddenTextArea',
			spellcheck: false,
			//value: this.state.text,
			onKeyDown: this.handleKeyDown,
			onKeyUp: this.handleKeyUp,
			onKeyPress: this.handleKeyPress,
			onFocus: this.handleFocus,
			onBlur: this.handleBlur,
			onChange: this.handleChange,
			onInput: this.handleInput,
			style: {top: this.top + 'px',"-webkit-user-select":"auto"},
		});
		this.preview = Preview({doc: this.state.doc, selection: this.state.selection, editor:this});
		return DOM.div({className: 'editor',
				onMouseDown: this.handleMouseDown,
				onMouseUp: this.handleMouseUp,
				onClick: this.handleClick,
				//onMouseMove: this.handleMouseMove,
			},[this.textarea, this.preview,
		this.hiddenPasteArea = DOM.div({className: 'hiddenPasteArea', 
			id:'hiddenPasteArea',
			contentEditable: true,
			style:{
				position: 'absolute',
				left: '-6000px',
				zIndex: '-1000',
				top: '0px',
			}},[]),
		this.hiddenCopyArea = DOM.div({className: 'hiddenCopyArea', 
			id:'hiddenCopyArea',
			style:{
				position: 'absolute',
				left: '-6000px',
				zIndex: '-1000',
				top: '0px',
			}},[Preview({
			doc: this.state.doc,
			selection: this.state.selection,
			editor:this,
			onlySelection: true,
		})])]);
	},
	_onChange: function() {
		var store = this.props.store;
		this.setState({
			doc: store.document(),
			selection: store.selection
		});
	},
	selection: function() {
		return this.state.selection;
	},
	select: function(selection) {
		this.setState({selection: selection});
		this.props.store.select(selection);
		setTimeout(this.scrollToCursor, 10);
	},
	document: function() {
		return this.state.doc;
	},
	store: function() {
		return this.props.store;
	},
	apply: function(ops, selection, compose) {
		//console.log(JSON.stringify(ops));
		this.props.store.apply(ops, selection, compose);
		console.log('After apply: ' + JSON.stringify(this.props.store.selection));
	},
	applyLocal: function(ops) {
		this.props.store.applyLocal(ops);
		console.log('After applyLocal: ' + JSON.stringify(this.props.store.selection));
	},
	scrollToCursor: function() {
		//TODO: this should be smarter and 
		// have some form of keep centered etc.
		// and or not scroll at all if the cursor is in
		// view
		var h = window.innerHeight;
		var c;
		var br;
		var cs = this.node.getElementsByClassName('cursor');
		if (cs.length === 0) return; //no cursors
		for (var i = cs.length-1; i >= 0; i--) {
			c = cs[i];
			br = c.getBoundingClientRect();
			if (br.bottom > 0 && br.bottom < h) return; //already in view
		}
		//none of the cursors are in view
		var mid = (br.bottom + br.top) / 2
		var ebr = this.node.getBoundingClientRect();
		var scrollTop = -ebr.top;
		//var scrollTop = this.node.ownerDocument.body.scrollTop;
		var top = (br.top + scrollTop) + 'px';
		this.textarea.node.style.top = top;
		this.textarea.node.scrollIntoViewIfNeeded();
		//scrollBy(0, mid-h/2);
	},
	undo: function() {
		this.props.store.undo();
	},
	redo: function() {
		this.props.store.redo();
	},
});

module.exports = {
	Editor: Editor,
	Document: Document,
	friar: friar,
	htmlToDoc: htmlToDoc,
	VALID_DOC: VALID_DOC,
};