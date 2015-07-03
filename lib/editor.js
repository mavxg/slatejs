//Render the document content to a DOM node
// and handle document/window events

var ottype = require('ot-sexpr');

var AttributedString = ottype.AttributedString;

var friar = require('friar');
var _Selection = ottype.Selection;
var Region = ottype.Region;
var sym = ottype.sym;

//var actions = require('./actions');
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

function renderChildren(children, _sel) {
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
				var subsubsel = subsel.slice(coff, coff+l);
				//(  [...)...(....)...(...]...)
				//(  [...]  )
				for (var k = 0; k < subsubsel.regions.length; k++) {
					var r = subsubsel.regions[k];
					var beg = r.begin();
					var end = r.end();
					if (beg > o) {
						c.push(DOM.span({},chunk.str.slice(o,beg)));
						o = beg;
					}
					if (r.focus === beg && beg >= 0)
						c.push(DOM.span({className:'cursor'},""));
					if (end > o)
						c.push(DOM.span({className:'selected'},chunk.str.slice(o,end)));
					if (r.focus === end && end <= l)
						c.push(DOM.span({className:'cursor'},""));
					o = end;
				};
				if (o < l || o === 0)
					c.push(DOM.span({},chunk.str.slice(o,l)));
				if (attr.strong)
					c = [DOM.strong({},c)];
				if (attr.em)
					c = [DOM.em({},c)];
				if (attr.sup)
					c = [DOM.sup({},c)];
				if (attr.sub)
					c = [DOM.sub({},c)];
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
			return DOM[tag](props, renderChildren(children, this.props.selection));
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
		var rchildren = renderChildren(children, this.props.selection);
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
			else children = renderChildren(children, subsel);
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
    if (event.shiftKey && base != "Shift") name = "Shift-" + name;
    if (event.altKey && base != "Alt") name = "Alt-" + name;
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
	'Space': 'space',
	'Shift-Space': 'space',

	'Ctrl-B': 'bold',
	'Cmd-B': 'bold',
	'Ctrl-I': 'em',
	'Cmd-I': 'em',
	'Ctrl-,': 'sub',
	'Cmd-,': 'sub',
	'Ctrl-.': 'sup',
	'Cmd-.': 'sup',
	'Alt-Shift-5': 'strike',
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
	//var focusP = pathFor(this.focus, editor);
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
	var first = true;
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
			first = false;
		} else if (first) {
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
			doc: store.document(),
			selection: store.selection
		};
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
		if (e.ctrlKey && e.target.nodeName === "A") return; //ctrl click link
		this.mouseDown = true;
		this.lastAction	= 'mouseDown';
		var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
		/*
		//TODO
		this.cursor = new Cursor(caret);
		var selection = this.cursor.toSelection(this.node, this.state.doc);
		this.state.selection = selection; //don't want to send all the mouse
		this.updateCursors(); //move events to the server.
		*/
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
			var caret = coordsCaret(this.preview.node, e.clientX, e.clientY);
			/*
			//TODO
			this.cursor = new Cursor(caret, this.cursor.anchor);
			var selection = this.cursor.toSelection(this.node, this.state.doc);
			this.props.store.select(selection);
			*/
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
			/*
			//TODO
			this.cursor = new Cursor(caret, this.cursor.anchor);
			var selection = this.cursor.toSelection(this.node, this.state.doc);

			this.state.selection = selection; //don't want to send all the mouse
			this.updateCursors(); //move events to the server.
			*/
			e.preventDefault();
		};
	},
	updateCursors: function() {
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
		//TODO: this breaks tags.
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
	}
});

module.exports = {
	Editor: Editor,
	Table: Table,
	Document: Document,
	friar: friar,
};