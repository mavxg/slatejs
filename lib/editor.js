//Render the document content to a DOM node
// and handle document/window events

var friar = require('friar');
var model = require('./model');
var Operations = require('./operations');
var _Selection = require('./selection');
var actions = require('./actions');
var caret = require('./caret');

var createClass = friar.createClass;
var DOM         = friar.DOM;

var TABLE_CLASS = 'pure-table pure-table-bordered';

var KEY_PREFIX = 'clay:';
var reKey = /^clay:/;
var reClay = /clay:/;

function keyToId(key) {
	return KEY_PREFIX + key.toString(36);
}

function idToKey(id) {
	return parseInt(id.slice(KEY_PREFIX.length), 36);
}

function fixSpaces(m) {
	var ret = '';
	for (var i = m.length; i >= 1; i--) ret += "\u00A0";
	return ret;
}

function renderChildren(children, _ret) {
	var stack = [];
	var yard = [];
	var ret = _ret || [];
	var wrapped = null;
	var wtag;

	function endTag(tag) {
		var t = stack.pop();
		var c;
		while (t !== undefined && t.t.key !== tag) {
			t.c.push(DOM[t.t.key](Object.create(t.t.value),ret));
			ret = t.c;
			yard.push(t.t);
			t = stack.pop();
		}
		if (t === undefined) {
			//end tag without start tag
			//wrap everything in this tag
			//assume no attributes.
			ret = [DOM[tag]({},ret)];
		} else {
			t.c.push(DOM[tag](Object.create(t.t.value),ret));
			ret = t.c;
		}
		while ((c = yard.pop())) {
			stack.push({c:ret, t:c});
			ret = [];
		}
	}

	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		var _type = m.type(child);
		if (wrapped !== null && wrapped !== _type) {
			//unwrap
			endTag(wtag);
			wrapped = null;
		}
		switch (_type) {
			case 'string':
				ret.push(DOM.text(
					child.replace(/\s\s+|\s+$/g, fixSpaces)));
				break;
			case 'tag':
				stack.push({c:ret, t:child});
				ret = [];
				break;
			case 'endtag':
				endTag(child.key);
				break;
			case 'attrib':     break; //don't do anything for attribs
			case 'Document':   ret.push(Document({obj:child, key:keyToId(child.id)})); break;
			case 'Section':    ret.push(Section({obj:child, key:keyToId(child.id)})); break;
			case 'Fragment':   break; //Fragments don't get rendered in place
			case 'P':          ret.push(P({obj:child, key:keyToId(child.id)})); break;
			case 'H1':         ret.push(H1({obj:child, key:keyToId(child.id)})); break;
			case 'H2':         ret.push(H2({obj:child, key:keyToId(child.id)})); break;
			case 'H3':         ret.push(H3({obj:child, key:keyToId(child.id)})); break;
			case 'Quote':      ret.push(Quote({obj:child, key:keyToId(child.id)})); break;
			case 'PullQuote':  ret.push(PullQuote({obj:child, key:keyToId(child.id)})); break;
			case 'Ulli':
				if (wrapped === null) {
					wtag = 'ul';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = [];
				}   
				ret.push(Li({obj:child, key:keyToId(child.id)})); 
				break;
			case 'Olli':
				if (wrapped === null) {
					wtag = 'ol';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = []; 
				}   
				ret.push(Li({obj:child, key:keyToId(child.id)}));
				break;
			case 'Code':
				if (wrapped === null) {
					wtag = 'pre';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = [];
				}
				ret.push(Code({obj:child, key:keyToId(child.id)}));
				ret.push(DOM.text('\n'));
				break;
			case 'Figure':     ret.push(Figure({obj:child, key:keyToId(child.id)})); break;
			case 'FigCaption': ret.push(FigCaption({obj:child, key:keyToId(child.id)})); break;
			case 'Table':      ret.push(Table({obj:child, key:keyToId(child.id)})); break;
			case 'Image':      ret.push(Image({obj:child, key:keyToId(child.id)})); break;
			default:           ret.push(Node({obj:child, key:keyToId(child.id)})); break;
		};
	};

	var t;
	while ((t=stack.pop()) !== undefined) {
		t.c.push(DOM[t.t.key](Object.create(t.t.value),ret));
		ret = t.c;
	}
	return ret;
}

function makeClass(tag, className) {
	return createClass({
		render: function() {
			var obj = this.props.obj;
			var props = {
				id: keyToId(obj.id), 
			};
			if (className !== undefined) props.className = className;
			//TODO: probably want to just iterate over attributes
			if (obj.alt)     props.alt     = obj.alt;
			if (obj.title)   props.title   = obj.title;
			if (obj.src)     props.src     = obj.src;
			if (obj.href)    props.href    = obj.href;
			return DOM[tag](props, renderChildren(obj.children));
		}
	});
}

var Node       = makeClass('span');
var H1         = makeClass('h1');
var H2         = makeClass('h2');
var H3         = makeClass('h3');
var Section    = makeClass('section');
var Document   = makeClass('div');
var P          = makeClass('p');
var Quote      = makeClass('blockquote');
var PullQuote  = makeClass('blockquote', 'pullquote');
var Fragment   = makeClass('span', 'fragment');
var Figure     = makeClass('figure');
var FigCaption = makeClass('figcaption');
var Image      = makeClass('img');
var Li         = makeClass('li'); //wrap with UL or OL
var Code       = makeClass('code'); //wrap with div>(pre + result)

var Row = createClass({
	render: function() {
		var row = this.props.row;
		var tag = this.props.tag;
		var alignments = this.props.alignments || [];
		var classes = this.props.classes || [];
		var cells = [];
		var offset = 0;
		for (var i = 0; i < row.children.length; i++) {
			var cell = row.children[i];
			if (cell instanceof model.Cell) {
				var alignment = alignments[i + offset] || 'left';
				var props = {
					id: keyToId(cell.id)
				};
				if (cell.colSpan) props.colSpan = cell.colSpan;
				if (cell.rowSpan) props.rowSpan = cell.rowSpan;
				if (classes[i + offset]) props.className = classes[i + offset];
				if (alignment !== 'left') {
					props.style = {};
					props.style['text-align'] = alignment;
				}
				cells.push(DOM[tag || 'td'](props, renderChildren(cell.children)));
				if (cell.colSpan) offset += cell.colSpan - 1;
			}
		}
		return DOM.tr({ id: keyToId(row.id) }, cells);
	}
});

function makeTableRegion(tag, celltag) {
	return createClass({
		render: function() {
			var obj = this.props.obj;
			var rows = [];
			for (var i = 0; i < obj.children.length; i++) {
				var row = obj.children[i];
				if (!row instanceof model.Row) continue;
				rows.push(Row({
					row: row,
					key: keyToId(row.id),
					tag: celltag,
					alignments: this.props.alignments,
					classes: this.props.classes,
				}));
			};
			return DOM[tag]({id: keyToId(obj.id)}, rows);
		}
	})
}

var THead = makeTableRegion('thead', 'th');
var TBody = makeTableRegion('tbody', 'td');
var TFoot = makeTableRegion('tfoot', 'td');

var Table = createClass({
	render: function() {
		var table = this.props.obj;
		var rgns = [];
		for (var i = 0; i < table.children.length; i++) {
			var rgn = table.children[i];
			var klass = null;
			if (rgn instanceof model.THead)      klass = THead;
			else if (rgn instanceof model.TBody) klass = TBody;
			else if (rgn instanceof model.TFoot) klass = TFoot;
			else                                 continue;
			rgns.push(klass({
				obj: rgn,
				key: keyToId(rgn.id),
				alignments: table.alignments,
				classes: table.classes,
			}));
		};
		return DOM.table({
			id: keyToId(table.id),
			className: TABLE_CLASS,
		}, rgns);

	}
});

var keyNames = {
	3: "Enter", 8: "Backspace", 9: "Tab", 
	13: "Enter", 16: "Shift", 17: "Ctrl", 
	18: "Alt", 19: "Pause", 20: "CapsLock", 
	27: "Esc", 32: "Space", 33: "PageUp", 
	34: "PageDown", 35: "End",36: "Home", 
	37: "Left", 38: "Up", 39: "Right", 
	40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 
    91: "Mod", 92: "Mod", 93: "Mod", 
    107: "=", 109: "-", 127: "Delete",
    173: "-", 186: ";", 187: "=", 
    188: ",", 189: "-", 190: ".", 
    191: "/", 192: "`", 219: "[", 
    220: "\\", 221: "]", 222: "'", 
    63232: "Up", 63233: "Down", 63234: "Left", 
    63235: "Right", 63272: "Delete", 63273: "Home", 
    63275: "End", 63276: "PageUp", 63277: "PageDown", 
    63302: "Insert"
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
    if (event.altKey && base != "Alt") name = "Alt-" + name;
    if (event.shiftKey && base != "Shift") name = "Shift-" + name;
    if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name;
    if (event.metaKey && base != "Cmd") name = "Cmd-" + name;
    return name;
};

var keymap = {
	'Ctrl-Z': 'undo',
	'Cmd-Z': 'undo',
	'Ctrl-Y': 'redo',
	'Cmd-Y': 'redo',
	'Cmd-Shift-Z': 'redo',
	'Ctrl-Shift-Z': 'redo',
	'Shift-Left': 'extendCharLeft',
	'Shift-Right': 'extendCharRight',
	'Shift-Up': 'extendLineUp',
	'Shift-Down': 'extendLineDown',
	'Left': 'goCharLeft',
	'Right': 'goCharRight',
	'Up': 'goLineUp',
	'Down': 'goLineDown',
	'Enter': 'newline',
	'Delete': 'delCharAfter',
	'Backspace': 'delCharBefore',
};

//Render a selection
var Selection = createClass({
	getInitialState: function() {
		return {
			focus: false,
			caret: null,
			rects: [],
		};
	},
	render: function() {
		var colour = this.props.colour;
		if (this.state.rects.length > 0) {
			return DOM.div({className: 'selection'},
				this.state.rects.map(function(rect) {
					return DOM.div({style: {
        				top: rect.top + 'px',
        				left: rect.left + 'px',
        				height: rect.height + 'px',
        				width: rect.width + 'px',
        				background: colour}}," ");
				}));
		}
		return DOM.div({className: 'selection'},[]);
	}
});

//Render document
var Preview = createClass({
	render: function() {
		return Document({obj: this.props.doc});
	}
});

function isChildOf(node, ancestor) {
	var _node = node;
	while(_node) {
		if (_node === ancestor) return true;
		_node = _node.parentNode;
	}
	return false;
}

var coordsCaret = caret.coordsCaret;

function Cursor(focus, anchor, goalCol, hitSide) {
	this.focus = focus;
	this.anchor = (anchor !== undefined) ? anchor : focus;
	this.goalCol = goalCol || null;
	this.hitSide = !!hitSide;
}
Cursor.prototype.isCollapsed = function() {
	return this.focus.node === this.anchor.node &&
		this.focus.offset === this.anchor.offset;
};
Cursor.prototype.toSelection = function(editor, doc) {
	var focusP = pathFor(this.focus, editor);
	var focus = doc.positionFromPath.apply(doc, focusP);
	var anchor = (this.isCollapsed()) ?
				focus :
				doc.positionFromPath.apply(doc, pathFor(this.anchor, editor));
	return new _Selection(anchor, focus);
};


function pathFor(point, editor) {
	var path = [];
	var node = point.node;
	var offset = point.offset;
	if (node.nodeType !== 3) {
		if (offset < node.childNodes.length) {
			node = node.childNodes[offset];
			node.childNodes.length
		} else if (node.childNodes.length > 0) {
			node = node.childNodes[node.childNodes.length - 1];
			offset = node.textContent.length;
		} else {
			offset = 0;
		}
	}
	while (node && node !== editor) {
		if (node.id && reKey.test(node.id)) {
			path.push(idToKey(node.id));
		} else {
			//check prevSiblings textContent length and add them
			// to offset if they don't have a node.id
			var prevSib = node.previousSibling;
			while (prevSib !== null && !reClay.test(node.id || '')) {
				offset += prevSib.textContent.length;
				prevSib = prevSib.previousSibling;
			}
		}
		node = node.parentNode;
	}
	return [path, offset];
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

function rectsForSelection(editor, doc, sel) {
	var st = sel.start();
	var en = sel.end();
	var prect = editor.getBoundingClientRect()
	var ptop = prect.top;
	var pleft = prect.left;
	var range = document.createRange();
	var res = []
	doc.selectedNodes(st, en).forEach(function(n) {
		var node = n.node;
		var id = keyToId(node.id);
		var e = document.getElementById(id);
		if (e === null) return {top: 0, left:0, width:0, height: 0};
		var er = e.getBoundingClientRect();
		if (n.start !== undefined) {
			var ne = e;
			var ts = node.textOffset(n.start);
			var te = node.textOffset(n.end);
			var toff = 0;
			for (var i = 0; i < ne.childNodes.length; i++) {
				var child = ne.childNodes[i];
				var cl = child.textContent.length;
				if (toff + cl >= ts) {
					if (child.nodeType === 3) {
						range.setStart(child, Math.max(0,Math.min(ts - toff, cl)));
						break;
					} else {
						ne = child;
						i = -1;
					}
				} else {
					toff += cl;
				}
			}
			toff = 0;
			ne = e;
			for (var i = 0; i < ne.childNodes.length; i++) {
				var child = ne.childNodes[i];
				var cl = child.textContent.length;
				if (toff + cl >= te) {
					if (child.nodeType === 3) {
						range.setEnd(child, Math.max(0, te - toff));
						break;
					} else {
						ne = child;
						i = -1;
					}
				} else {
					toff += cl;
				}
			}
			//TODO: this doesn't work for inline
			// as the bounding rect is incorrect
			// as it goes all the way to the end
			// of any wrapped elements.
			var rects = range.getClientRects();
			var r = range.getBoundingClientRect();
			var len = rects.length;
			if (ts === te && len > 0) er = rects[0];
			if (ts !== te && len > 0) {
				var farLeft = Math.floor(r.left);
				var farRight = Math.ceil(r.right);
				var re = rects[0];
				res.push({
					top: re.top - ptop,
					left: re.left - pleft,
					width: (farRight - re.left),
					height: (re.bottom - re.top)});
				var fbot = re.bottom;
				var cs = {
					top: 0,
					left: farLeft,
				}
				if (len > 1) {
					re = rects[len - 1];
					var gap = re.top - fbot;
					var bot;
					if (gap < re.height * 0.6) {
						bot = {
							top: re.top - ptop - gap,
							left: farLeft - pleft,
							width: (re.right - farLeft),
							height: ((re.bottom - re.top) + gap)
						};
					} else {
						bot = {
							top: re.top - ptop,
							left: farLeft - pleft,
							width: (re.right - farLeft),
							height: (re.bottom - re.top)
						};
						res.push({
							top: fbot - ptop,
							left: farLeft - pleft,
							width: farRight - farLeft,
							height: gap,
						});
					}
					res.push(bot);
				}
			} else {
				res.push({
				top: er.top - ptop,
				left: er.left - pleft,
				width: (er.right - er.left),
				height: (er.bottom - er.top)});
			}
			
		} else {
			res.push({
				top: er.top - ptop,
				left: er.left - pleft,
				width: (er.right - er.left),
				height: (er.bottom - er.top)});
		}
	});
	return res;
}

var Editor = createClass({
	getInitialState: function() {
		this.prevInput = '';
		this.focused = false;
		this.poll_id = null;
		this.cursor = null; //TODO: put some of this in state.
		this.top = 0;
		this.shouldCompose = false;
		this.lastAction = null;
		var store = this.props.store;
		return {
			doc: store.document,
			selection: store.selection,
			clients: store.clients,
			revision: store.revision,
		};
	},
	didMount: function() {
		setTimeout(this.ensureFocus, 20);
		this.props.store.on('change', this._onChange);
		var ta = this.textarea.node;
		ta.addEventListener('paste', this.handlePaste);
		ta.addEventListener('cut', this.handleCut);
		ta.addEventListener('copy', this.handleCopy);
		document.body.addEventListener('mouseup', this.handleBodyMouseUp);
		document.body.addEventListener('mousemove', this.handleBodyMouseMove);
		setTimeout(this.updateCursors,0);
	},
	willUnmount: function() {
		this.focused = false;
		var ta = this.textarea.node;
		this.props.store.removeListener('change', this._onChange);
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
		//find input diff
		var i = 0; l = Math.min(prevInput.length, text.length);
		while (i < l && prevInput.charCodeAt(i) === text.charCodeAt(i)) ++i;
		var inserted = text.slice(i);
		var offset = 0;
		if (i < prevInput.length) {
			//delete some characters
			offset = -(prevInput.length - i);
		};
		this.props.store.replaceSelection([inserted],offset, this.lastAction === 'typing');
		this.shouldCompose = true;
		this.lastAction	= 'typing';

		if (text.length > 1000 || /[\n ]/.test(text)) {
			input.value = this.prevInput = ''; //empty if long
		} else {
			this.prevInput = input.value;
		}
	},
	resetInput: function() {
		this.textarea.node.value = this.prevInput = '';
	},
	ensureFocus: function() {
		this.textarea.node.focus();
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
	handleKeyDown: function(e) {
		//ensureFocus
		//handleKeyBinding
		var name = keyName(e);
		var action = keymap[name];
		if (actions[action]) {
			actions[action](this.props.store, this);
			e.preventDefault();
		}
	},
	handleKeyUp: function(e) {
		//change shift status
		this.poll(); //fast poll once.
	},
	handleChange: function(e) {
		this.poll(); //fast poll once.
	},
	handleInput: function(e) {
		this.poll(); //fast poll once.
	},
	handleFocus: function(e) {
		console.log('focus');
		//this.resetInput();
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
	handleMouseDown: function(e) {
		//TODO: check for control (so they can click on )
		this.mouseDown = true;
		this.lastAction	= 'mouseDown';
		var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
		this.cursor = new Cursor(caret);
		var selection = this.cursor.toSelection(this.node, this.state.doc);
		this.state.selection = selection; //don't want to send all the mouse
		this.updateCursors(); //move events to the server.
		e.preventDefault();
	},
	handleBodyMouseUp: function(e) {
		if (this.mouseDown) {
			console.log('body mouse up');
			this.mouseDown = false;
			var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
			this.cursor = new Cursor(caret, this.cursor.anchor);
			var selection = this.cursor.toSelection(this.node, this.state.doc);
			this.props.store.select(selection);
		};
	},
	handleMouseUp: function(e) {
		console.log('mouse up');
		if (this.mouseDown) {
			this.mouseDown = false;
			var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
			this.cursor = new Cursor(caret, this.cursor.anchor);
			var selection = this.cursor.toSelection(this.node, this.state.doc);
			this.props.store.select(selection);
		};
		this.ensureFocus();
	},
	handleBodyMouseMove: function(e) {
		if (this.mouseDown) {
			var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
			this.cursor = new Cursor(caret, this.cursor.anchor);
			var selection = this.cursor.toSelection(this.node, this.state.doc);

			this.state.selection = selection; //don't want to send all the mouse
			this.updateCursors(); //move events to the server.
			e.preventDefault();
		};
	},
	updateCursors: function() {
		var rects = rectsForSelection(this.node, this.state.doc, this.state.selection);
		this.selection.setState({rects: rects});
		if (rects.length > 0) {
			this.top = this.state.selection.isInverted() ? 
				rects[0].top : 
				rects[rects.length - 1].top;
		}
		this.textarea.node.style.top = this.top + 'px';
	},
	vertical: function(dir, unit, extend, cursor) { //TODO: unit ignored should support paragraph
		var preview = this.preview.node;
		var bounds = preview.getBoundingClientRect();
		var rect = cursor.focus.getClientRect();
		var target = null;
		var x = cursor.goalCol || rect.right;
		var goalCol = x;
		var y = dir > 0? rect.bottom + 3 : rect.top - 3;
		var hitSide = cursor.hitSide;
		if (hitSide) {
			y = (rect.bottom + rect.top) / 2;
			hitSide = false;
		}
		for (;;) {
			target = coordsCaret(preview, x, y);
			if (!target.outside) break;
			if (dir < 0 ? y <= bounds.top : y >= bounds.bottom) {
				hitSide = true;
				if (dir < 0)
					target.offset = 0;
				else if (target.node.nodeType === 3)
					target.offset = target.node.length;
				break;
			}
			y += dir * 5;
		}
		if (extend)
			return new Cursor(target, cursor.anchor, goalCol, hitSide);
		return new Cursor(target, target, goalCol, hitSide);
	},
	horizontal: function(dir, unit, extend, selection) {
		var focus = this.state.doc.offset(selection.focus, dir, unit);
		if (extend)
			return new _Selection(selection.anchor, focus, selection.who);
		return new _Selection(focus, focus, selection.who);
	},
	moveV: function(dir, unit, extend) {
		this.cursor = this.vertical(dir, unit, extend, this.cursor);
		var selection = this.cursor.toSelection(this.node, this.state.doc);
		this.props.store.select(selection);
		this.lastAction	= 'move';
	},
	moveH: function(dir, unit, extend) {
		var selection = this.horizontal(dir, unit, extend, this.state.selection);
		this.props.store.select(selection);
		this.lastAction	= 'move';
	},
	deleteH: function(dir, unit) {
		var selection = this.state.selection;
		if (selection.isCollapsed()) {
			selection = this.horizontal(dir, unit, true, selection, true);
		}
		this.props.store.replaceSelection([],0,this.lastAction === 'delete', selection);
		this.lastAction = 'delete';
	},
	didUpdate: function() {
		setTimeout(this.updateCursors,0);
	},
	handleCut: function(e) {
		console.log('cut');
		this.lastAction	= 'cut';
		//Clone all the selected elements
		//so we can then cut the
	},
	handleCopy: function(e) {
		console.log('copy');
		this.lastAction	= 'copy';
		var range = document.createaRange();
		this.pasteArea.node.innerHTML = '';
		var div = document.createElement('div');
		rangesForSelection(this.state.doc, 
			this.state.selection).forEach(function(r) {
				var frag = r.cloneContents();
				//TODO: this needs to wrap things like table cells 
				// based on common parent element
				div.appendChild(frag);
			});
		this.pasteArea.node.appendChild(div);
		range.selectNodeContents(this.pasteArea.node);
		var sel = document.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		return this;
	},
	handlePaste: function(e) {
		console.log('paste');
		this.lastAction	= 'paste';
	},
	render: function() {
		//Not allowed in react.
		//might need to use a timeout to clear
		//textArea after reload (ie sometimes restores content magic)
		this.textarea = DOM.textarea({
			//id: 'model', 
			className: 'hiddenTextArea',
			//value: this.state.text,
			onKeyDown: this.handleKeyDown,
			onKeyUp: this.handleKeyUp,
			onKeyPress: this.handleKeyPress,
			onFocus: this.handleFocus,
			onBlur: this.handleBlur,
			onChange: this.handleChange,
			onInput: this.handleInput,
			style: {top: this.top + 'px'},
		});
		this.pasteArea = DOM.div({className: 'hiddenPasteArea', 
			style:{
				position: 'absolute',
				left: '-6000px',
				zIndex: '-1000',
				top: '0px',
			}},[]); //area to paste in and out of
		this.preview = Preview({doc: this.state.doc});
		this.selection = Selection({colour: 'rgba(128,0, 236, 0.51)'}); //state actually sets where to render
		//TODO: all the other selections (clients)
		return DOM.div({className: 'editor',
				onMouseDown: this.handleMouseDown,
				onMouseUp: this.handleMouseUp,
				//onMouseMove: this.handleMouseMove,
			},[this.textarea, this.selection, this.preview, this.pasteArea]);
	},
	_onChange: function() {
		var store = this.props.store;
		this.setState({
			doc: store.document,
			selection: store.selection,
			clients: store.clients,
			revision: store.revision,
		});
	}
});

module.exports = {
	Editor: Editor,
	Table: Table,
	Document: Document,
	friar: friar,
};