/*

TODO:

implement methods that return operations

implement table methods
implement annotate (strong etc)
implement unannotate (remove strong etc)
implement replaceSelection() -- move from store to model

//available commands depends on merged path.
// if you have matching names then the lowest one wins
// ops gets initialised with a retain to that node.

Table.prototype.commands = {
	....: function(ops, startindex, endindex) {
		...
	}
}

*/

var Selection = require('./selection');

var UNDEFINED;

//e.g. Author, HeaderFragmentId, etc
//TODO: these should not be here...
// they should just be part of the typespec
//function Attrib(key, value) {
//	this.attrib = key;
//	this.value = value;
//};
//Attrib.prototype.toJSON = function() {
//	return {attrib:this.attrib, value:this.value};
//};
//function attrib(attrib, value) { return new Attrib(attrib, value); }

//e.g. Link, Bold, etc
function Tag(key, value) {
	this.key = key;
	this.value = value;
};
Tag.prototype.toJSON = function() {
	return {tag:this.key, value:this.value};
};
function tag(key, value) { return new Tag(key, value); }

function EndTag(key) {
	this.key = key;
};
EndTag.prototype.toJSON = function() {
	return {endTag:this.key};
};
function endtag(key) { return new EndTag(key); }

function TypeSpec(key, id, attributes) {
	this._type = key;
	if (id) this.id = id;
	if (attributes) this.attributes = attributes;
}
TypeSpec.prototype.toJSON = function() {
	var ret = {_type: this._type};
	if (this.id) ret[id] = this.id;
	if (this.attributes) ret[attributes] = this.attributes;
	return ret;
};

function Node(id, children, attributes) {
	this.id = id;
	this.children = children || [];
	this.length = 1; //1 for this node
	var m = this.id;
	this.attributes = attributes || {};
	if (attributes) for (var attrib in attributes) 
		if (attributes.hasOwnProperty(attrib))
			this[attrib] = attributes[attrib];
	for (var i = this.children.length - 1; i >= 0; i--) {
		var child = this.children[i];
		this.length += (child.length ? child.length : 1);
		//if (child instanceof Attrib)
		//	this[child.attrib] = child.value;
		if (child._maxId && child._maxId > m) m = child._maxId;
	};
	this._maxId = m;
}
Node.prototype.toJSON = function() {
	return {
		type: this.className,
		id: this.id,
		children: this.children,
		attributes: this.attributes
	};
};
Node.prototype.prefix = function(_start, _end, _expandAll, _level, _lin) {
	var lin = _lin || [];
	var start = (_start === UNDEFINED) ? 0 : _start;
	var end = (_end === UNDEFINED) ? this.length : _end;
	var level = (_level === UNDEFINED) ? 0 : _level;
	//TODO: need a special extra (next op level that allows a return this when
		// the next op level >= this.level)
	if (!_expandAll && level >= this.level && start <= 0 && end > this.length) {
		lin.push(this);
		return lin;
	}
	if (end > 0 && start <= 0)
		lin.push(new TypeSpec(this.className, this.id, this.attributes));
	var offset = 1;
	var cl;
	var s;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (start < offset + cl && end > offset) {
			s = (start > offset) ? start - offset : 0;
			if (child.prefix) {
				child.prefix(s, end - offset, _expandAll, level, lin);
				level = this.level; //set the level so future children
				                    //don't get flattened
			} else if (child.slice) lin.push(child.slice(s, end - offset));
			else lin.push(child);
		}
		offset += cl;
	};
	return lin;
};
Node.prototype.maxId = function() {
	return this._maxId;
}
Node.prototype.className = "Node";
Node.prototype.level     = 0;
Node.prototype.adjustSelection = function(selection) {
	//adjust selection (e.g column selection, full table selection)
	var start = selection.start();
	var end = selection.end();
	var nodes = this.selectedNodes(selection.start(), selection.end());


};
Node.prototype.selectedNodes = function(_start, end, _lin) {
	var lin = _lin || [];
	// return a list of node ids or offset ranges selected
	var start = (_start >= 0) ? _start : 0;
	if (start <= 0 && end >= this.length) {
		//whole node
		lin.push({node: this});
		return;
	}
	var offset = 1;
	var cl;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (start <= offset + cl && end > offset) {
			if (child.selectedNodes) {
				child.selectedNodes(_start - offset, end - offset, lin);
			}

		}
		offset += cl;
	};
	return lin;
};
Node.prototype.commonPath = function(start, end) {
	var startPath = this.path(start);
	if (start === end) return startPath;

	var endPath = this.path(end);
	var l = Math.min(startPath.length, endPath.length);
	var i = 0;
	for (; i < l; i++) {
		var sn = startPath[i];
		var en = endPath[i];
		if (sn.node !== en.node) break;
	}
	var ret = startPath.slice(0,i)
	ret.tags = startPath.tags;
	return ret;
};
Node.prototype.path = function(index, _path) {
	//node and offset in that node
	// last element should be a text offset
	// {node: node, offset: offset}
	var path = _path || [];
	var tags = path.tags = path.tags || {};
	if (index >= this.length) {
		path.push({node: this, offset: this.length});
		return path;
	}
	path.push({node: this, offset: index});
	var offset = 1;
	var cl;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (child instanceof Tag) tags[child.key] = child.value;
		if (child instanceof EndTag) delete tags[child.key];
		if (index <= offset + cl && index >= offset) {
			if (child.path) {
				child.path(index - offset, path);
			}
			return path;

		}
		offset += cl;
	};
	return path;
};
Node.prototype.textBefore = function(index) {
	if (index <= 1) return '';
	var offset = 1;
	var cl;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (index <= offset + cl && 
			index >= offset && 
			child.textBefore) {
			return child.textBefore(index - offset);
		}
		offset += cl;
	};
	return '';
};
Node.prototype.positionFromPath = function(ids, offset) {
	var node = this;
	var i = ids.length - 1;
	var pos = 0;
	var cl;
	if (node.id !== ids[i]) return pos;//last id must be this one
	i--;
	pos += 1;
	for (; i >= 0; i--) {
		var id = ids[i];
		var chl = node.children.length
		for (var j = 0; j < chl; j++) { //must go in order to add up length.
			var child = node.children[j];
			cl = child.length || 1;
			if (child.id === id) {
				node = child;
				pos += 1;
				break;
			}
			pos += cl;
		};
	};
	return pos + node.realOffset(offset);
};
Node.prototype.realOffset = function(textoffset) {
	var real = 0;
	var fake = textoffset;
	var chl = this.children.length
	for (var j = 0; j < chl; j++) { //must go in order to add up length.
		var child = this.children[j];
		cl = child.length || 1;
		if (typeof child === 'string') fake -= cl;
		real += cl;
		if (fake <= 0) {
			real += fake;
			break;
		}
	}
	return real;
};
Node.prototype.textOffset = function(realoffset) {
	var real = realoffset;
	var fake = 0;
	var chl = this.children.length
	for (var j = 0; j < chl; j++) { //must go in order to add up length.
		var child = this.children[j];
		cl = child.length || 1;
		if (typeof child === 'string') fake += cl;
		real -= cl;
		if (real <= 0) {
			fake += real;
			break;
		}
	}
	return fake;
};
Node.prototype.offset = function(index, dir, unit, keepInNode) {
	return index + dir; //TODO
};
Node.prototype.commands = [];

//Nodes that can contain text.
function TNode() {}
TNode.prototype = new Node();
TNode.prototype.selectedNodes = function(_start, _end, _lin) {
	var start = _start - 1;
	var end = _end - 1;
	var lin = _lin || [];
	// return a list of node ids or offset ranges selected
	var start = (start >= 0) ? start : 0;
	if (_start <= 0 && _end >= this.length) {
		//whole node
		lin.push({node: this});
	} else {
		var e = (end > this.length) ? this.length : end;
		lin.push({node: this, start: start, end: e});
	}
	return lin;
};
TNode.prototype.textBefore = function(index) {
	if (index <= 1) return '';
	var offset = 1;
	var cl;
	var ret = '';
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (index > offset) {
			if (typeof child === 'string') {
				ret += child.slice(0, index - offset);
			}
		} else break;
		offset += cl;
	};
	return ret;
};

Table.prototype.rows = function() {
	var rows = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		if (child instanceof Row) rows++;
	}
	return rows;
};

function Document   (id, children, attrs) { Node.call(this, id, children, attrs); }
function Section    (id, children, attrs) { Node.call(this, id, children, attrs); }
function Fragment   (id, children, attrs) { Node.call(this, id, children, attrs); }
function P          (id, children, attrs) { Node.call(this, id, children, attrs); }
function H1         (id, children, attrs) { Node.call(this, id, children, attrs); }
function H2         (id, children, attrs) { Node.call(this, id, children, attrs); }
function H3         (id, children, attrs) { Node.call(this, id, children, attrs); }
function Quote      (id, children, attrs) { Node.call(this, id, children, attrs); }
function PullQuote  (id, children, attrs) { Node.call(this, id, children, attrs); }
function Ulli       (id, children, attrs) { Node.call(this, id, children, attrs); }
function Olli       (id, children, attrs) { Node.call(this, id, children, attrs); }
function Code       (id, children, attrs) { Node.call(this, id, children, attrs); }
function Figure     (id, children, attrs) { Node.call(this, id, children, attrs); }
function FigCaption (id, children, attrs) { Node.call(this, id, children, attrs); }
function Table      (id, children, attrs) {
	//defaults
	this.headerRows = 1;
	this.headerCols = 0;
	Node.call(this, id, children, attrs); 
}
function Row        (id, children, attrs) { Node.call(this, id, children, attrs); }
function Cell       (id, children, attrs) { Node.call(this, id, children, attrs); }
function Image      (id, children, attrs) { Node.call(this, id, children, attrs); }

Document.prototype             = new Node();
Section.prototype              = new Node();
Fragment.prototype             = new Node();
P.prototype                    = new TNode();
H1.prototype                   = new TNode();
H2.prototype                   = new TNode();
H3.prototype                   = new TNode();
Quote.prototype                = new TNode();
PullQuote.prototype            = new TNode();
Ulli.prototype                 = new TNode();
Olli.prototype                 = new TNode();
Code.prototype                 = new TNode();
Figure.prototype               = new Node();
FigCaption.prototype           = new TNode();
Table.prototype                = new Node();
Row.prototype                  = new Node();
Cell.prototype                 = new TNode();
Image.prototype                = new Node();

TNode.prototype.tagRange = function(ops, _start, _end, key, _value) {
	var value = _value || {};
	var off = 1;
	var start = Math.max(1, Math.min(this.length, _start));
	var end = Math.max(1, Math.min(this.length, _end));
	var diff = end - start;
	var current;
	var cchild;
	var lastTag;
	var i = 0;
	var child;
	var cl;
	var sub = 0;
	for (; i < this.children.length; i++) {
		child = this.children[i];
		cl = child.length || 1;
		if (off + cl > start) {
			sub = start - off;
			break;
		}
		if (child instanceof Tag && child.key === key) {
			current = child.value;
			cchild = child;
			lastTag = off;
		} else if (child instanceof EndTag && child.key === key) current = undefined;
		off += cl;
	}
	if (_value && JSON.stringify(value) !== JSON.stringify(current)) {
		ops.retain(lastTag);
		ops.remove(cchild);
		ops.insert({tag: key, value: value});
		ops.retain(start - lastTag - 1);
	} else {
		ops.retain(start);
	}
	if (current === undefined) ops.insert({tag: key, value: value});
	for (; i < this.children.length; i++) {
		child = this.children[i];
		cl = child.length || 1;
		if (off + cl > end) break;
		if (child instanceof Tag && child.key === key) {
			current = true;
			ops.remove(child);
		} else if (child instanceof EndTag && child.key === key) {
			current = undefined;
			ops.remove(child);
		} else {
			ops.retain(cl - sub);
			sub = 0;
		}
		off += cl;
	}
	ops.retain(end - off - sub)
	if (current === undefined) ops.insert({endTag: key});
	ops.retain(this.length - end);
};

TNode.prototype.untagRange = function(ops, _start, _end, key) {
	var off = 1;
	var start = Math.max(1, Math.min(this.length, _start));
	var end = Math.max(1, Math.min(this.length, _end));
	var diff = end - start;
	var current;
	var cchild;
	var lastTag;
	var i = 0;
	var child;
	var cl;
	var sub = 0;
	for (; i < this.children.length; i++) {
		child = this.children[i];
		cl = child.length || 1;
		if (off + cl > start) {
			sub = start - off;
			break;
		}
		if (child instanceof Tag && child.key === key)
			current = child.value;
		else if (child instanceof EndTag && child.key === key)
			current = undefined;
		off += cl;
	}
	ops.retain(start);
	if (current !== undefined) ops.insert({endTag: key});
	for (; i < this.children.length; i++) {
		child = this.children[i];
		cl = child.length || 1;
		if (off + cl > end) break;
		if (child instanceof Tag && child.key === key) {
			current = true;
			ops.remove(child);
		} else if (child instanceof EndTag && child.key === key) {
			current = undefined;
			ops.remove(child);
		} else {
			ops.retain(cl - sub);
			sub = 0;
		}
		off += cl;
	}
	ops.retain(end - off - sub)
	if (current !== undefined) ops.insert({tag: key, value: current});
	ops.retain(this.length - end);
};

TNode.prototype.strong   = function(ops, start, end) { this.tagRange(ops, start, end, "strong"); }
TNode.prototype.unstrong = function(ops, start, end) { this.untagRange(ops, start, end, "strong"); }
TNode.prototype.em       = function(ops, start, end) { this.tagRange(ops, start, end, "em"); }
TNode.prototype.unem     = function(ops, start, end) { this.untagRange(ops, start, end, "em"); }
TNode.prototype.sup      = function(ops, start, end) { this.tagRange(ops, start, end, "sup"); }
TNode.prototype.unsup    = function(ops, start, end) { this.untagRange(ops, start, end, "sup"); }
TNode.prototype.sub      = function(ops, start, end) { this.tagRange(ops, start, end, "sub"); }
TNode.prototype.unsub    = function(ops, start, end) { this.untagRange(ops, start, end, "sub"); }
TNode.prototype.strike   = function(ops, start, end) { this.tagRange(ops, start, end, "del"); }
TNode.prototype.unstrike = function(ops, start, end) { this.untagRange(ops, start, end, "del"); }

TNode.prototype.commands = [
    "strong", "unstrong", 
    "sup", "unsup", 
    "sub", "unsub",
	"em", "unem", 
	"link", "unlink", 
	"strike", "unstrike",
];

Table.prototype.commands = [
	"alignCenter",
	"alignLeft",
	"alignRight",
	"insertRowsBefore",
	"insertRowsAfter",
	"insertColsBefore",
	"insertColsAfter",
	"deleteRows",
	"deleteCols",
];


Table.prototype.selectedNodes = function(_start, end, _lin) {
	var lin = _lin || [];
	if ((_start <= 0 && end >= this.length) || 
		_start < 0 || end > this.length) {
		//whole table if start is outside or end is outside
		lin.push({node: this});
		//annotate so we can expand the selection
		if (_start < 0 && end < this.length)
			lin._end = this.length + end;
		else if (end > this.length && _start > 0)
			lin._start = _start;
		return;
	}
	//Otherwise we do column wise selection if the start and end
	//are not in the same cell.
	var start = (_start >= 0) ? _start : 0;
	var startCell = this.cellAt(start);
	if (start - startCell.offset + startCell.node.length > end) {
		//selection within single cell
		lin.push({
			node: startCell.node, 
			start: startCell.offset, 
			end: end - start + startCell.offset});
	} else {
		var endCell = this.cellAt(end);
		var minCol = Math.min(startCell.column, endCell.column);
		var minRow = Math.min(startCell.row, endCell.row);
		var maxCol = Math.max(startCell.column + (startCell.node.colSpan || 1) - 1,
			endCell.column + (endCell.node.colSpan || 1) - 1);
		var maxRow = Math.max(startCell.row + (startCell.node.rowSpan || 1) - 1,
			endCell.row + (endCell.node.rowSpan || 1) - 1);
		var crow = 0;
		var ccell = 0;
		for (var r = 0; r < this.children.length; r++){
			var row = this.children[r];
			if (row instanceof Row) {
				var ccell = 0;
				if (crow >= minRow) for (var c = 0; c < row.children.length; c++) {
					var cell = row.children[c];
					if (cell instanceof Cell) {
						if (ccell >= minCol) lin.push({node: cell});
						ccell++;
						if (ccell > maxCol) break;
					}
				}
				crow++;
				if (crow > maxRow) return lin;
			}
		}
	}
	return lin;
};
Table.prototype.cellAt = function(_offset) {
	var offset = _offset - 1;
	var cl;
	var row = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (offset <= cl && child.cellAt) {
			return child.cellAt(offset, row);
		}
		if (child instanceof Row) row++;
		offset -= cl;
	};
	return child.cellAt(cl - 1, row-1);
};

Row.prototype.cellAt = function(_offset, row) {
	var offset = _offset - 1;
	var cl;
	var col = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (offset <= cl && child instanceof Cell) {
			return {node: child, offset: offset - 1, column: col, row: row};
		}
		if (child instanceof Cell) col++;
		offset -= cl;
	};
};
Row.prototype.columns = function() {
	var cols = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		if (child instanceof Cell)
			cols += (child.colSpan === undefined) ? 1 : child.colSpan;
	}
	return cols;
};

Table.prototype.columns = function() {
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		if (child instanceof Row)
			return child.columns();
	}
	return 0;
};

//modification methods (ops is out parameter)
Table.prototype.insertColumns = function(ops, c, n) {
	var _n = n === undefined ? 1 : n;
	
};
Table.prototype.insertRows = function(ops, row, n, cols) {
	var rows = n === undefined ? 1 : n;
	var _cols = cols || this.columns();
	if (_cols < 1) return; //no columns (should probably retain self)
	ops.retain(1);
	var remaining = this.length - 1;
	var _r = row;
	//skip over rows 
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		var cl = child.length || 1;
		if (child instanceof Row) {
			if (_r <= 0) break;
			_r -= 1;
		}
		remaining -= cl;
		ops.retain(cl);
	}
	for (var r = 0; r < rows; r++) {
		ops.insert({_type:'Row'})
		for (var c = 0; c < _cols; c++) {
			ops.insert({_type:'Cell'})
		}
	}
	ops.retain(remaining);
};
Table.prototype.deleteColumns = function(ops /*, cols */) {
	var cols = arguments.slice(1);
};
Table.prototype.deleteRows = function(ops /*, rows */) {
	var rows = arguments.slice(1);
};
Table.prototype.mergeCells = function(ops, srow, scol, erow, ecol) {
	// TODO
};
Table.prototype.splitCell = function(ops, row, col) {
	// TODO
};

Document.prototype.className   = "Document";
Section.prototype.className    = "Section";
Fragment.prototype.className   = "Fragment";
P.prototype.className          = "P";
H1.prototype.className         = "H1";
H2.prototype.className         = "H2";
H3.prototype.className         = "H3";
Quote.prototype.className      = "Quote";
PullQuote.prototype.className  = "PullQuote";
Ulli.prototype.className       = "Ulli";
Olli.prototype.className       = "Olli";
Code.prototype.className       = "Code";
Figure.prototype.className     = "Figure";
FigCaption.prototype.className = "FigCaption";
Table.prototype.className      = "Table";
Row.prototype.className        = "Row";
Cell.prototype.className       = "Cell";
Image.prototype.className      = "Image";

Document.prototype.level       = 10;
Section.prototype.level        = 9;
Fragment.prototype.level       = 9;
P.prototype.level              = 8;
H1.prototype.level             = 8;
H2.prototype.level             = 8;
H3.prototype.level             = 8;
Quote.prototype.level          = 8;
PullQuote.prototype.level      = 8;
Ulli.prototype.level           = 8;
Olli.prototype.level           = 8;
Code.prototype.level           = 8;
Figure.prototype.level         = 8;
FigCaption.prototype.level     = 3;
Table.prototype.level          = 8;
Row.prototype.level            = 6;
Cell.prototype.level           = 5;
Image.prototype.level          = 3;

//TODO: make Image and FigCaption the same level as text and tags (1)
// make attributes level 0

var KLASS = {
	Document  : Document,
	Section   : Section,
	Fragment  : Fragment,
	P         : P,
	H1        : H1,
	H2        : H2,
	H3        : H3,
	Quote     : Quote,
	PullQuote : PullQuote,
	Ulli      : Ulli,
	Olli      : Olli,
	Code      : Code,
	Figure    : Figure,
	FigCaption : FigCaption,
	Table     : Table,
	Row       : Row,
	Cell      : Cell,
	Image     : Image,
};

function _type(obj) {
	if (typeof obj === 'string') return 'string';
	if (obj instanceof Tag) return 'tag';
	if (obj instanceof EndTag) return 'endtag';
	if (obj instanceof Node) return obj.className;
	if (obj instanceof TypeSpec) return 'typespec';
	return 'unknown';
}

function level(obj) {
	if (obj === UNDEFINED) return 1000000;
	if (obj instanceof Node) return obj.level;
	return 0;
}

function apply(doc, ops) {
	var seed = doc.maxId();
	var stack = [];
	var stacks = [];
	var _level = 1000000;
	var op;
	var offset = 0;
	var lin;

	if (ops.inputLen !== doc.length)
		throw "Operations input length does not match document length";

	function unwind(toLevel) {
		var t;
		while (_level <= toLevel && (t = stacks.pop())) {
			_level = t.level;
			var c = stack;
			stack = t.stack;
			stack.push(new t.klass(t.id, c, t.attributes));
		}
	}

	function process(obj) {
		var lvl;
		if (obj instanceof TypeSpec) {
			var c = [];
			var klass = KLASS[obj._type] || Node;
			var lvl = klass.prototype.level;
			if (lvl >= _level) unwind(lvl);
			stacks.push({stack: stack, klass: klass, level: _level, id: obj.id, attributes: obj.attributes});
			stack = [];
			_level = lvl;
			
		} else if (typeof obj === 'string' && 
			typeof stack[stack.length - 1] === 'string') {
			stack[stack.length - 1] = stack[stack.length - 1] + obj;
		} else {
			lvl = level(obj);
			if (lvl >= _level) unwind(lvl);
			stack.push(obj);
		}
	}

	function fromObj(obj) {
		if (typeof obj === 'string') return obj;
		if (obj._type)  return new TypeSpec(obj._type, obj.id || ++seed, obj.attributes);
		if (obj.tag)    return new Tag(obj.tag, obj.value);
		if (obj.endTag) return new EndTag(obj.endTag);
		//if (obj.attrib) return new Attrib(obj.attrib, obj.value);
		return obj;
	}

	for (var i = 0; i < ops.ops.length; i++) {
		var op = ops.ops[i];
		if (ops.isRetain(op)) {
			lin = doc.prefix(offset, offset + op.n, false, _level);
			lin.forEach(process);
		} else if (ops.isInsert(op)) {
			process(fromObj(op.str));
		} else { //remove
			//TODO: check that remove actually matches
		}
		offset += op.inputLen;
	};
	unwind(1000000);
	return stack.pop();
};

module.exports = {
	Node      : Node,
	Document  : Document,
	Section   : Section,
	Fragment  : Fragment,
	P         : P,
	H1        : H1,
	H2        : H2,
	H3        : H3,
	Quote     : Quote,
	PullQuote : PullQuote,
	Ulli      : Ulli,
	Olli      : Olli,
	Code      : Code,
	Figure    : Figure,
	FigCaption : FigCaption,
	Table     : Table,
	Row       : Row,
	Cell      : Cell,
	Image     : Image,
	tag       : tag,
	endtag    : endtag,
	apply     : apply,
	type      : _type,
};