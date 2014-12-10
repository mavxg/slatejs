//Render the document content to a DOM node
// and handle document/window events

var friar = require('friar');
var model = require('./model');

var createClass = friar.createClass;
var DOM         = friar.DOM;

var TABLE_CLASS = 'pure-table pure-table-bordered';

var KEY_PREFIX = 'clay:';
var reKey = /clay:/;

function keyToId(key) {
	return KEY_PREFIX + key.toString(36);
}

function idToKey(id) {
	return parseInt(id.slice(KEY_PREFIX.length), 36);
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
				ret.push(DOM.text(child));
				break;
			case 'tag':
				stack.push({c:ret, t:child});
				ret = [];
				break;
			case 'endtag':
				endTag(child.key);
				break;
			case 'attrib':     break; //don't do anything for attribs
			case 'Document':   ret.push(Document({obj:child})); break;
			case 'Section':    ret.push(Section({obj:child})); break;
			case 'Fragment':   break; //Fragments don't get rendered in place
			case 'P':          ret.push(P({obj:child})); break;
			case 'H1':         ret.push(H1({obj:child})); break;
			case 'H2':         ret.push(H2({obj:child})); break;
			case 'H3':         ret.push(H3({obj:child})); break;
			case 'Quote':      ret.push(Quote({obj:child})); break;
			case 'PullQuote':  ret.push(PullQuote({obj:child})); break;
			case 'Ulli':
				if (wrapped === null) {
					wtag = 'ul';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = [];
				}   
				ret.push(Li({obj:child})); 
				break;
			case 'Olli':
				if (wrapped === null) {
					wtag = 'ol';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = []; 
				}   
				ret.push(Li({obj:child}));
				break;
			case 'Code':
				if (wrapped === null) {
					wtag = 'pre';
					stack.push({c:ret, t:m.tag(wtag ,{id: '_' + keyToId(child.id)})});
					wrapped = _type;
					ret = [];
				}
				ret.push(Code({obj:child}));
				ret.push(DOM.text('\n'));
				break;
			case 'Figure':     ret.push(Figure({obj:child})); break;
			case 'FigCaption': ret.push(FigCaption({obj:child})); break;
			case 'Table':      ret.push(Table({obj:child})); break;
			case 'Image':      ret.push(Image({obj:child})); break;
			default:           ret.push(Node({obj:child})); break;
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
			if (!cell instanceof model.Cell) continue;
			var alignment = alignments[i + offset] || 'left';
			var props = {
				id: keyToId(cell.id)
			};
			if (classes[i + offset]) props.className = classes[i + offset];
			if (alignment !== 'left') {
				props.style = {};
				props.style['text-align'] = alignment;
			}
			cells.push(DOM[tag || 'td'](props, renderChildren(cell.children)));
			if (cell.colSpan) offset += cell.colSpan - 1;
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
    if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name;
    if (event.metaKey && base != "Cmd") name = "Cmd-" + name;
    if (event.shiftKey && base != "Shift") name = "Shift-" + name;
    return name;
};

function noop() {}

//TODO
function copy(e, editor) {}
function cut(e, editor) {}
function undo(e, editor) {}
function redo(e, editor) {}
function paste(e, editor) {}
function moveH(dir, extend) {
	return noop;
}
function moveV(dir, extend) {
	return noop;
}

var keymap = {
	'Ctrl-C': copy,
	'Cmd-C': copy,
	'Ctrl-X': cut,
	'Cmd-X': cut,
	'Ctrl-Z': undo,
	'Cmd-Z': undo,
	'Ctrl-Y': undo,
	'Cmd-Shift-Z': redo,
	'Ctrl': noop,
	'Ctrl-Shift': noop,
	'Shift': noop,
	'Alt': noop,
	'Cmd': noop,
	'Cmd-Shift': noop,
	'Shift-Left': moveH(-1, true),
	'Shift-Right': moveH(1, true),
	'Shift-Up': moveV(-1, true),
	'Shift-Down': moveV(1, true),
	'Left': moveH(-1),
	'Right': moveH(1),
	'Up': moveV(-1),
	'Down': moveV(1),
};

//Render a selection
var Selection = createClass({

});

//Render document
var Preview = createClass({

});

var HiddenTextArea = createClass({
	handleKeyDown: function(e) {

	},
	handleKeyUp: function(e) {

	},
	handleChange: function(e) {

	},
	handleInput: function(e) {

	},
	handleFocus: function(e) {
		if (this.props.onFocus) this.props.onFocus(e);
	},
	handleBlur: function(e) {
		if (this.props.onBlur) this.props.onBlur(e);
	},
	render: function() {
		return DOM.textarea({
			className: 'hiddenTextArea',
			style:     this.props.style,
			onKeyDown: this.handleKeyDown,
			onKeyUp:   this.handleKeyUp,
			onChange:  this.handleChange,
			onInput:   this.handleInput,
			onFocus:   this.handleFocus,
			onBlur:    this.handleBlur,
		});
	}
});

var Editor = createClass({
	willUnmount: function() {
		//
	},
	render: function() {
	}
});


module.exports = {
	Editor: Editor,
	Table: Table,
	Document: Document,
	friar: friar,
};