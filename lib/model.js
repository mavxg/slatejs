/*


TODO:

zero width items (for errors and results). Idea is they don't get synced.

*/

var Selection = require('./selection');

var UNDEFINED;

//e.g. Author, HeaderFragmentId, etc
function Attrib(key, value) {
	this.attrib = key;
	this.value = value;
};
Attrib.prototype.toJSON = function() {
	return {attrib:this.attrib, value:this.value};
};
function attrib(attrib, value) { return new Attrib(attrib, value); }

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

function TypeSpec(key, id) {
	this._type = key;
	if (id) this.id = id;
}
TypeSpec.prototype.toJSON = function() {
	if (this.id)
		return {_type: this._type, id: this.id};
	return {_type: this._type};
};

function Node(id, children) {
	this.id = id;
	this.children = children || [];
	this.length = 1; //1 for this node
	var m = this.id;
	for (var i = this.children.length - 1; i >= 0; i--) {
		var child = this.children[i];
		this.length += (child.length ? child.length : 1);
		if (child instanceof Attrib)
			this[child.attrib] = child.value;
		if (child._maxId && child._maxId > m) m = child._maxId;
	};
	this._maxId = m;
}
Node.prototype.toJSON = function() {
	return {
		type: this.className,
		id: this.id,
		children: this.children,
	};
};
Node.prototype.rpn = function(_start, _end, _expandAll, _level, _lin) {
	var lin = _lin || [];
	var start = (_start === UNDEFINED) ? 0 : _start;
	var end = (_end === UNDEFINED) ? this.length : _end;
	var level = (_level === UNDEFINED) ? 0 : _level;
	if (!_expandAll && level >= this.level && start <= 0 && end >= this.length) {
		lin.push(this);
		return lin;
	}
	var offset = 0;
	var cl;
	var s;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (start < offset + cl && end > offset) {
			s = (start > offset) ? start - offset : 0;
			if (child.rpn) {
				child.rpn(s, end - offset, _expandAll, level, lin);
				level = this.level; //set the level so future children
				                    //don't get flattened
			} else if (child.slice) lin.push(child.slice(s, end - offset));
			else lin.push(child);
		}
		offset += cl;
	};
	if (end >= this.length && start < this.length)
		lin.push(new TypeSpec(this.className, this.id));
	return lin;
};
Node.prototype.maxId = function() {
	return this._maxId;
}
Node.prototype.className = "Node";
Node.prototype.level     = 0;
Node.prototype.adjustSelection = function(selection) {
	//adjust selection (e.g column selection, full table selection)
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
	var offset = 0;
	var cl;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (start < offset + cl && end >= offset) {
			if (child.selectedNodes) {
				child.selectedNodes(_start - offset, end - offset, lin);
			}
		}
		offset += cl;
	};
	return lin;
};
Node.prototype.positionFromPath = function(ids, offset) {
	var node = this;
	var i = ids.length - 1;
	var pos = 0;
	var cl;
	if (node.id !== ids[i]) return pos;//last id must be this one
	i--;
	for (; i >= 0; i--) {
		var id = ids[i];
		var chl = node.children.length
		for (var j = 0; j < chl; j++) { //must go in order to add up length.
			var child = node.children[j];
			cl = child.length || 1;
			if (child.id === id) {
				node = child;
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

//Nodes that can contain text.
function TNode() {}
TNode.prototype = new Node();
TNode.prototype.selectedNodes = function(_start, end, _lin) {
	var lin = _lin || [];
	// return a list of node ids or offset ranges selected
	var start = (_start >= 0) ? _start : 0;
	if (start <= 0 && end >= this.length) {
		//whole node
		lin.push({node: this});
	} else {
		var e = (end > this.length) ? this.length : end;
		lin.push({node: this, start: start, end: e});
	}
	return lin;
};

function TableRegionNode() {}
TableRegionNode.prototype = new Node();
TableRegionNode.prototype.cellAt = function(_offset, _rows) {
	var offset = _offset;
	var cl;
	var row = _rows;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (offset <= cl && child.cellAt) {
			return child.cellAt(offset, row);
		}
		if (child instanceof Row) row++;
		offset -= cl;
	};
};
TableRegionNode.prototype.rows = function() {
	var rows = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		if (child instanceof Row) rows++;
	}
	return rows;
};

function Document (id, children) { Node.call(this, id, children); }
function Section  (id, children) { Node.call(this, id, children); }
function Fragment (id, children) { Node.call(this, id, children); }
function P        (id, children) { Node.call(this, id, children); }
function H1       (id, children) { Node.call(this, id, children); }
function H2       (id, children) { Node.call(this, id, children); }
function H3       (id, children) { Node.call(this, id, children); }
function Quote    (id, children) { Node.call(this, id, children); }
function PullQuote(id, children) { Node.call(this, id, children); }
function Ulli     (id, children) { Node.call(this, id, children); }
function Olli     (id, children) { Node.call(this, id, children); }
function Code     (id, children) { Node.call(this, id, children); }
function Figure   (id, children) { Node.call(this, id, children); }
function FigCaption (id, children) { Node.call(this, id, children); }
function Table    (id, children) { Node.call(this, id, children); }
function THead    (id, children) { Node.call(this, id, children); }
function TBody    (id, children) { Node.call(this, id, children); }
function TFoot    (id, children) { Node.call(this, id, children); }
function Row      (id, children) { Node.call(this, id, children); }
function Cell     (id, children) { Node.call(this, id, children); }
function Image    (id, children) { Node.call(this, id, children); }

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
THead.prototype                = new TableRegionNode();
TBody.prototype                = new TableRegionNode();
TFoot.prototype                = new TableRegionNode();
Row.prototype                  = new Node();
Cell.prototype                 = new TNode();
Image.prototype                = new Node();

Table.prototype.selectedNodes = function(_start, end, _lin) {
	var lin = _lin || [];
	if ((_start <= 0 && end >= this.length) || 
		_start < 0 || end > this.length) {
		//whole table if start is outside or end is outside
		lin.push({node: this});
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
		for (var i = 0; i < this.children.length; i++) {
			var region = this.children[i];
			if (region instanceof TableRegionNode) {
				for (var r = 0; r < region.children.length; r++){
					var row = region.children[r];
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
			
		}
	}
	return lin;
};
Table.prototype.cellAt = function(_offset) {
	var offset = _offset;
	var cl;
	var rows = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (offset <= cl && child.cellAt) {
			return child.cellAt(offset, rows);
		}
		if (child.rows) rows += child.rows();
		offset -= cl;
	};
};

Row.prototype.cellAt = function(_offset, row) {
	var offset = _offset;
	var cl;
	var col = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (offset <= cl && child instanceof Cell) {
			return {node: child, offset: offset, column: col, row: row};
		}
		if (child instanceof Cell) col++;
		offset -= cl;
	};
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
THead.prototype.className      = "THead";
TBody.prototype.className      = "TBody";
TFoot.prototype.className      = "TFoot";
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
THead.prototype.level          = 7;
TBody.prototype.level          = 7;
TFoot.prototype.level          = 7;
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
	THead     : THead,
	TBody     : TBody,
	TFoot     : TFoot,
	Row       : Row,
	Cell      : Cell,
	Image     : Image,
};

function _type(obj) {
	if (typeof obj === 'string') return 'string';
	if (obj instanceof Tag) return 'tag';
	if (obj instanceof EndTag) return 'endtag';
	if (obj instanceof Attrib) return 'attrib';
	if (obj instanceof Node) return obj.className;
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
	var op;
	var offset = 0;
	var lin;

	if (ops.inputLen !== doc.length)
		throw "Operations input length does not match document length";

	function process(obj) {
		if (obj instanceof TypeSpec) {
			var c = [];
			var klass = KLASS[obj._type] || Node;
			var l = klass.prototype.level;
			for (var i = stack.length - 1; i >= 0; i--) {
				t = stack[i];
				if (level(t) >= l) break;
				c.push(stack.pop());
			};
			c.reverse();
			stack.push(new klass(obj.id, c));
		} else if (typeof obj === 'string' && 
			typeof stack[stack.length - 1] === 'string') {
			stack[stack.length - 1] = stack[stack.length - 1] + obj;
		} else {
			stack.push(obj);
		}
	}

	function fromObj(obj) {
		if (typeof obj === 'string') return obj;
		if (obj._type)  return new TypeSpec(obj._type, obj.id || ++seed);
		if (obj.tag)    return new Tag(this.tag, this.value);
		if (obj.endTag) return new EndTag(this.endTag);
		if (obj.attrib) return new Attrib(this.attrib, this.value);
		return obj;
	}

	for (var i = 0; i < ops.ops.length; i++) {
		var op = ops.ops[i];
		if (ops.isRetain(op)) {
			lin = doc.rpn(offset, offset + op.n, false, level(stack[stack.length - 1]));
			lin.forEach(process);
		} else if (ops.isInsert(op)) {
			process(fromObj(op.str));
		} else { //remove
			//TODO: check that remove actually matches
		}
		offset += op.inputLen;
	};
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
	THead     : THead,
	TBody     : TBody,
	TFoot     : TFoot,
	Row       : Row,
	Cell      : Cell,
	Image     : Image,
	attrib    : attrib,
	tag       : tag,
	endtag    : endtag,
	apply     : apply,
	type      : _type,
};