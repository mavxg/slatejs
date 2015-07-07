//Render the document content to a DOM node
// and handle document/window events

var ottype = require('ot-sexpr');

var AttributedString = ottype.AttributedString;

var friar = require('friar');
var _Selection = ottype.Selection;
var Region = ottype.Region;
var sym = ottype.sym;

//var actions = require('./actions');

var createClass = friar.createClass;
var DOM         = friar.DOM;

var TABLE_CLASS = 'pure-table pure-table-bordered';

var KEY_PREFIX = 'clay:';
var reKey = /^clay:/;
var reKeyIndexOffset = /^clay:([^:]+):(\d+):(\d+)/;
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

function renderChildren(children, _sel, parentId) {
	var stack = [];
	var ret = [];
	var wrapped = null;
	var indent = 0;
	var subsel;
	var sel = _sel || new _Selection();
	var offset = 2; //skip up and head

	function wrap(_type, wtag, id, cindent) {
		while (indent < cindent) {
			indent++;
			stack.push({c:ret, tag:wtag, type:wrapped, props:{id:('_' + keyToId(id) + '_' + indent)}});
		}
		wrapped = _type;
		ret = [];
	}

	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (!child) {
			console.log("What happened")
		}

		if (child instanceof AttributedString) {
			subsel = sel.slice(offset+1,offset + child.size-1);
			var chunks = (child.length > 0) ? child.chunk() : [{str:"\u00A0", attributes:{}}];
			var coff = 0;
			for (var j = 0; j < chunks.length; j++) {
				var chunk = chunks[j];
				var attr = chunk.attributes;
				var l = chunk.str.length;
				var o = 0;
				var c = [];
				var key;
				var subsubsel = subsel.slice(coff, coff+l);
				function fs(s) {
					return s.replace(/ +$/,fixSpaces).replace(/  +/g,fixSpaces);
				}
				//(  [...)...(....)...(...]...)
				//(  [...]  )
				for (var k = 0; k < subsubsel.regions.length; k++) {
					var r = subsubsel.regions[k];
					var beg = r.begin();
					var end = r.end();
					if (beg > o) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
						c.push(DOM.span({id:key},fs(chunk.str.slice(o,beg))));
						o = beg;
					}
					if (r.focus === beg && beg >= 0) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + beg) + '_cursor';
						c.push(DOM.span({id:key,className:'cursor'},""));
					}
					if (end > o) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
						c.push(DOM.span({id:key,className:'selected'},fs(chunk.str.slice(o,end))));
					}
					if (r.focus === end && end <= l && end > beg) {

						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + end) + '_cursor';
						c.push(DOM.span({id:key,className:'cursor'},""));
					}
					o = end;
				};
				if (o < l || o === 0) {
					key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
					c.push(DOM.span({id:key},fs(chunk.str.slice(o,l))));
				}
				if (attr.strong)
					c = [DOM.strong({},c)];
				if (attr.em)
					c = [DOM.em({},c)];
				if (attr.sup)
					c = [DOM.sup({},c)];
				if (attr.sub)
					c = [DOM.sub({},c)];
				if (attr.strike)
					c = [DOM.span({style:{"text-decoration":"line-through"}},c)];
				if (attr.underline)
					c = [DOM.span({style:{"text-decoration":"underline"}},c)];
				if (attr.href)
					c = [DOM.a({href:attr.href},c)];
				ret = ret.concat(c);
				coff += l;
			};
			offset += child.size;
			continue;
		}
		var _type = child.values[0].sym; //TODO. this should be .head()
		var attr = child.attributes || {};
		var cindent = (attr.indent || 1);
		var subsel = sel.slice(offset, offset + child.size);
		if (wrapped !== null && (wrapped !== _type || cindent < indent))  {
			//unwrap
			var t;
			while ((t=stack.pop()) !== undefined) {
				indent--;
				if (ret.length === 0) 
					ret.push(DOM.text("\u00A0"));
				t.c.push(DOM[t.tag](Object.create(t.props),ret));
				ret = t.c;
				wrapped = t.type;
				if (wrapped === _type && cindent === indent) break;
			}
		}
		switch (_type) {
			case 'doc':   ret.push(Document({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'section':    ret.push(Section({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'p':          ret.push(P({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'h1':         ret.push(H1({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'h2':         ret.push(H2({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'h3':         ret.push(H3({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'blockquote':      ret.push(Quote({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'pullquote':  ret.push(PullQuote({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			case 'ulli':
				if (cindent > indent)
					wrap(_type, 'ul',child.id, cindent);
				ret.push(Li({obj:child, selection:subsel, key:keyToId(child.id)})); 
				break;

			case 'olli':
				if (cindent > indent)
					wrap(_type, 'ol',child.id, cindent);
				ret.push(Li({obj:child, selection:subsel, key:keyToId(child.id)}));
				break;
			case 'code':
				if (cindent > indent)
					wrap(_type, 'pre',child.id, cindent);
				ret.push(Code({obj:child, selection:subsel, key:keyToId(child.id)}));
				ret.push(DOM.text('\n'));
				break;
			case 'table':      ret.push(Table({obj:child, selection:subsel, key:keyToId(child.id)})); break;
			default:           ret.push(Node({obj:child, selection:subsel, key:keyToId(child.id)})); break;
		};
		offset += child.size;
	};

	var t;
	while ((t=stack.pop()) !== undefined) {
		if (ret.length === 0) 
				ret.push(DOM.text("\u00A0"));
		t.c.push(DOM[t.tag](Object.create(t.props),ret));
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
			var children = obj.values.slice(1);
			if (children.length === 0) children = ["\u00A0"];
			return DOM[tag](props, renderChildren(children, this.props.selection, obj.id));
		}
	});
}

var Node       = makeClass('span');
var H1         = makeClass('h1');
var H2         = makeClass('h2');
var H3         = makeClass('h3');
//var Section    = makeClass('section');
var Document   = makeClass('div', 'content');
var P          = makeClass('p');
var Quote      = makeClass('blockquote');
var PullQuote  = makeClass('blockquote', 'pullquote');
var Fragment   = makeClass('span', 'fragment');
var Figure     = makeClass('figure');
var FigCaption = makeClass('figcaption');
var Image      = makeClass('img');
var Li         = makeClass('li'); //wrap with UL or OL
var Code       = makeClass('code'); //wrap with div>(pre + result)

var Section = createClass({
	render: function() {
		var obj = this.props.obj;
		var props = {
			id: keyToId(obj.id), 
		};
		var children = obj.tail();
		if (children.length === 0) children = ["\u00A0"];
		var rchildren = renderChildren(children, this.props.selection, obj.id);
		rchildren.push(DOM.hr({id: "hr-" + keyToId(obj.id)}))
		return DOM.section(props, rchildren);
	}
});

var Row = createClass({
	render: function() {
		var row = this.props.row;
		var tag = this.props.tag;
		var sel = this.props.selection;
		var alignments = this.props.alignments || [];
		var classes = this.props.classes || [];
		var cells = [];
		var offset = 0;
		var raw_cells = row.tail();
		var soffset = 2;

		var table_regions = sel.table_regions || [];

		for (var i = 0; i < raw_cells.length; i++) {
			var cellx = raw_cells[i];
			var subsel = sel.slice(soffset, soffset + cellx.size);
			var cell = cellx.attributes || {};
			soffset += cellx.size;

			var alignment = alignments[i + offset] || 'left';
			var props = {
				id: keyToId(cellx.id)
			};
			for (var j = table_regions.length - 1; j >= 0; j--) {
				var r = table_regions[j];
				if (r.start_col <= i && r.end_col >= i)
					props.className = 'selected';
			};
			if (cell.colSpan) props.colSpan = cell.colSpan;
			if (cell.rowSpan) props.rowSpan = cell.rowSpan;
			if (classes[i + offset]) props.className = classes[i + offset];
			if (alignment !== 'left') {
				props.style = {};
				props.style['text-align'] = alignment;
			}
			var children = cellx.tail();
			if (children.length === 0) children = [DOM.text("\u200B")];
			else children = renderChildren(children, subsel, cellx.id);
			cells.push(DOM[tag || 'td'](props, children)); ;
			if (cell.colSpan) offset += cell.colSpan - 1;
		}
		return DOM['tr']({ id: keyToId(row.id) }, cells);
	}
});


var _table = sym('table');
var _row = sym('row');

//cellAt takes an offset within the table
//node (including start of node)
_table.cellAt = function(node, _offset) {
	var offset = _offset - 2;
	var cl;
	var row = 0;
	var children = node.tail();
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		cl = child.size;
		if (offset <= cl) {
			return _row.cellAt(child, offset, row);
		}
		row++;
		offset -= cl;
	};
	return _row.cellAt(child, cl - 1, row-1);
};
//cellAt takes an offset within the row
//node (including start of node)
//returns {node:cell, offset:remainder, col:..., row:...}
_row.cellAt = function(node, _offset, row) {
	var offset = _offset - 2;
	var cl;
	var col = 0;
	var children = node.tail();
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		cl = child.size;
		if (offset <= cl) {
			return {node: child, offset: offset - 1, column: col, row: row};
		}
		col++;
		offset -= cl;
	};
};

var Table = createClass({
	render: function() {
		var table = this.props.obj;
		var rows = table.tail();
		var sel = this.props.selection;
		var props = {
			id: keyToId(table.id),
			className: TABLE_CLASS,
		};
		if (sel.regions.length > 0 && 
			(sel.regions[0].begin() < 2 || 
				sel.regions[sel.regions.length-1].end() >= table.size)) {
			props.className += ' selected';
			//colapse the selection to just focus
			//so we can draw any cursors (even though we have selected the whole table)
			sel = new _Selection(sel.regions.map(function(r) { return new Region(r.focus)}));
		}
		var numRows = rows.length;
		var headerRows = [];
		var attributes = table.attributes || {}
		var bodyRows = [];
		var numHeaderRows = attributes.headerRows || 0;

		//adjust the regions (for cell selection)
		//TODO: factor this out as we will need it for
		//actions. (should probably just be called adjust selection)
		var nregs = [];
		var table_regions = []
		for (var j = 0; j < sel.regions.length; j++) {
			var r = sel.regions[j];
			var start = r.begin();
			var end = r.end();
			var startCell =  _table.cellAt(table, start);
			if (start < 2 || start >= table.size ||
				start - startCell.offset + startCell.node.size > end) {
				//range within a single cell
			} else {
				//select cell ranges
				var endCell = _table.cellAt(table, end);
				var minCol = Math.min(startCell.column, endCell.column);
				var minRow = Math.min(startCell.row, endCell.row);
				var sAttr = startCell.node.attributes || {};
				var eAttr = endCell.node.attributes || {};
				var maxCol = Math.max(startCell.column + (sAttr.colSpan || 1) - 1,
					endCell.column + (eAttr.colSpan || 1) - 1);
				var maxRow = Math.max(startCell.row + (sAttr.rowSpan || 1) - 1,
					endCell.row + (eAttr.rowSpan || 1) - 1);
				r = new Region(r.focus);
				table_regions.push({start_row:minRow, start_col:minCol, 
					end_row:maxRow, end_col:maxCol});
			}
			nregs.push(r)
		};
		sel = new _Selection(nregs);
		if (table_regions.length > 0) sel.table_regions = table_regions;

		var row;
		var i = 0;
		var offset = 2;

		function _slice_table_regions(sel, row_num) {
			if (!sel.table_regions) return sel;
			var ret = [];
			for (var i = 0; i < sel.table_regions.length; i++) {
				var r = sel.table_regions[i];
				if (r.start_row <= row_num && r.end_row >= row_num)
					ret.push(r);
			};
			sel.table_regions = ret;
			return sel;
		}

		for (; i < numHeaderRows && i < numRows; i++) {
			row = rows[i];
			headerRows.push(Row({
					row: row,
					selection: _slice_table_regions(sel.slice(offset,offset + row.size),i),
					key: keyToId(row.id),
					tag: 'th',
					alignments: attributes.alignments,
					classes: attributes.classes,
					headerCols: attributes.headerCols,
				}));
			offset += row.size;
		}
		for (; i < numRows; i++) {
			row = rows[i];
			bodyRows.push(Row({
					row: row,
					selection: _slice_table_regions(sel.slice(offset,offset + row.size),i),
					rowNumber: i,
					tag: 'td',
					alignments: attributes.alignments,
					classes: attributes.classes,
					headerCols: attributes.headerCols,
				}));
			offset += row.size;
		}
		return DOM.table(props, [
			DOM.thead({}, headerRows),
			DOM.tbody({}, bodyRows),
			DOM.tfoot({}, [])
		]);

	}
});

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


//Render document
var Preview = createClass({
	render: function() {
		return Document({obj: this.props.doc, selection:this.props.selection});
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

function last(a) { return a[a.length - 1]; }

function offsetFromPoint(textnode, x, y) {
	var doc = textnode.ownerDocument;
	var range = doc.createRange();
	var len = textnode.length;
	if (len === 1 && textnode.textContent === "\u00A0") return 0;
	var rect;
	var rects;
	range.selectNode(textnode);
	rects = range.getClientRects();
	rect = range.getBoundingClientRect();
	var totalWidth = rect.right * 2;
	var innerY = Math.min(rect.bottom - 1, Math.max(rect.top + 1, y));
	//binary search
	var to = len;
	while (textnode.textContent[to - 1] === '\n') to -= 1;
	var from = 0;
	var fromX = rects[0].left;
	var toX = last(rects).right;
	var dist = to - from;
	var toWrong = false;
	for (;;) {
		if (to - from <= 1) {
			if (toWrong) return from;
			return (x < fromX || x - fromX <= toX - x) ? from : to;
		}
		var step = Math.ceil(dist / 2);
		var middle = from + step;
		range.setEnd(textnode, middle);
		rects = range.getClientRects();
		rect = last(rects);

		var rx = rect.right;
		if (rect.top > innerY) rx += totalWidth;
		else if (rect.bottom < innerY) rx -= totalWidth;

		if (x <= rx) { 
			to = middle; 
			dist = step; 
			toX = rect.right; 
			toWrong = rx !== rect.right 
		} else { from = middle; dist -= step; fromX = rect.right; }
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
};

var Editor = createClass({
	getInitialState: function() {
		//plugins are loaded into these properties
		this.commands = {};
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

		if (this.props.plugins) {
			var plugins = this.props.plugins;
			for (var i=0; i < plugins.length; i++)
				this.loadPlugin(plugins[i]);
		}

		var store = this.props.store;
		return {
			doc: store.document(),
			selection: store.selection,
			key_sequence: [], //stores the currently pressed key sequence
			//zoom: 0, //TODO: allow zooming into a node and only displaying that.
		};
	},
	loadPlugin: function(plugin) {
		//last command wins
		if (plugin.commands) {
			var commands = plugin.commands(this);
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
	},
	didMount: function() {
		/*
		var sdoc = this.props.sdoc; //sharejs doc
		var self = this
		sdoc.whenReady(function() {
			self.setState({doc:sdoc.getSnapshot()});
		});

		var context = sdoc.createContext();
		//put api on the type and then this is a register listener.
		//still need to put a bunch of listeners on sdoc
		//  for things like undo/redo...
		context._onOp = function(op) {
			self.setState({doc:context.getSnapshot()});
		};

		*/

		setTimeout(this.ensureFocus, 20);
		this.props.store.on('change', this._onChange);
		this.props.store.sharedoc.on('after op', this._onChange);
		var ta = this.textarea.node;
		ta.addEventListener('paste', this.handlePaste);
		ta.addEventListener('cut', this.handleCut);
		ta.addEventListener('copy', this.handleCopy);
		document.body.addEventListener('mouseup', this.handleBodyMouseUp);
		document.body.addEventListener('mousemove', this.handleBodyMouseMove);
		//setTimeout(this.updateCursors,0);
	},
	willUnmount: function() {
		this.focused = false;
		var ta = this.textarea.node;
		this.props.store.removeListener('change', this._onChange);
		this.props.store.sharedoc.removeListener('after op', this._onChange);
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
		this.props.store.replaceText(null, offset, inserted, null, this.lastAction === 'typing');
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
		console.log('ensureFocus')
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
	context: function(key, region) {
		switch (key) {
			case "head":
				var n = this.state.doc.nodeAt(region.focus);
				n = (typeof n.node.head !== 'function') ? n.parent : n.node;
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
	handleKeyDown: function(e) {
		//ensureFocus
		//handleKeyBinding
		var name = keyName(e).toLowerCase();
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
					this.run_command(shortcut.command, shortcut.args);
				} else {
					var nks = this.state.key_sequence.concat([name]);
					this.setState({key_sequence:nks});
				}
				matched = true;
			};
		}

		if (matched) {
			e.preventDefault();
		} else if (this.state.key_sequence && this.state.key_sequence.length > 0) {
			//no match so clear key sequence.
			this.setState({key_sequence:[]});
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
	window_to_text: function(v) {
		var x = v.clientX;
		var y = v.clientY;
		var elm = this.preview.node;
		var doc = this.state.doc;
		var point = 0;
		var m;
		while (elm) {
			if (elm.nodeType === 3) {
				var off = offsetFromPoint(elm, x, y);
				return point + off;
			}
			if (elm.id) {
				if (reKey.test(elm.id)) {
					if ((m=reKeyIndexOffset.exec(elm.id))) {
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
	run_command: function(string, args) {
		//TODO: start editing state?
		this.commands[string](args);
		//end editing state.
	},
	handleMouseDown: function(e) {
		if (e.ctrlKey && e.target.nodeName === "A") return; //ctrl click link
		if (e.ctrlKey || e.metaKey)
			this.merge_selection = this.state.selection;
		else
			this.merge_selection = new _Selection();
		this.mouseDown = true;
		this.lastAction	= 'mouseDown';
		var point = this.window_to_text(e);
		if (this.state.key_sequence && this.state.key_sequence.length > 0)
			this.setState({key_sequence:[]});
		this.anchor = point;
		this.props.store.select(this.merge_selection.add(new Region(point)));
		e.preventDefault();
		e.stopPropagation();
		return false;
	},
	handleClick: function(e) {
		if (e.ctrlKey && e.target.nodeName === "A") return; //ctrl click link
		e.preventDefault();
	},
	handleBodyMouseUp: function(e) {
		if (this.mouseDown) {
			console.log('body mouse up');
			this.mouseDown = false;
			var point = this.window_to_text(e);
			this.props.store.select(this.merge_selection.add(new Region(point,this.anchor || point)));
			var ta  =this.textarea.node;
			ta.style.top = (e.clientY + ta.ownerDocument.body.scrollTop) + 'px';
			this.ensureFocus();
		};
	},
	handleMouseUp: function(e) {
		console.log('mouse up');
		if (this.mouseDown) {
			this.mouseDown = false;
			var point = this.window_to_text(e);
			var ta  =this.textarea.node;
			ta.style.top = (e.clientY + ta.ownerDocument.body.scrollTop) + 'px';
			this.props.store.select(
				this.merge_selection.add(new Region(point,this.anchor || point)));
		};
		this.ensureFocus();
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
		//TODO: just move the textarea (or we could just leave it position fixed)
		/*var rects = rectsForSelection(this.node, this.state.doc, this.state.selection);
		this.selection.setState({rects: rects});
		if (rects.length > 0) {
			this.top = this.state.selection.isInverted() ? 
				rects[0].top : 
				rects[rects.length - 1].top;
		}
		this.textarea.node.style.top = this.top + 'px';
		*/
	},
	vertical: function(dir, unit, extend, cursor) { //TODO: unit ignored should support paragraph
		/*var preview = this.preview.node;
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
		*/
	},
	horizontal: function(dir, unit, extend, selection) {
		/*
		var focus = this.state.doc.offset(selection.focus, dir, unit);
		if (extend)
			return new _Selection(selection.anchor, focus, selection.who);
		return new _Selection(focus, focus, selection.who);
		*/
	},
	moveV: function(dir, unit, extend) {
		/*
		this.cursor = this.vertical(dir, unit, extend, this.cursor);
		var selection = this.cursor.toSelection(this.node, this.state.doc);
		this.props.store.select(selection);
		this.lastAction	= 'move';
		*/
	},
	moveH: function(dir, unit, extend) {
		/*
		var selection = this.horizontal(dir, unit, extend, this.state.selection);
		this.props.store.select(selection);
		this.lastAction	= 'move';
		*/
	},
	deleteH: function(dir, unit) {
		/*
		var selection = this.state.selection;
		//TODO: this breaks tags.
		if (selection.isCollapsed()) {
			selection = this.horizontal(dir, unit, true, selection, true);
		}
		this.props.store.replaceSelection([],0,this.lastAction === 'delete', selection);
		this.lastAction = 'delete';
		*/
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
		var range = document.createRange();
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
		this.preview = Preview({doc: this.state.doc, selection: this.state.selection});
		return DOM.div({className: 'editor',
				onMouseDown: this.handleMouseDown,
				onMouseUp: this.handleMouseUp,
				onClick: this.handleClick,
				//onMouseMove: this.handleMouseMove,
			},[this.textarea, this.preview, this.pasteArea]);
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
	document: function() {
		return this.state.doc;
	},
	apply: function(ops, selection, compose) {
		this.props.store.apply(ops, selection, compose);
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
	Table: Table,
	Document: Document,
	friar: friar,
};