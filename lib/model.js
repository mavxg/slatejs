/*


TODO:

zero width items (for errors and results). Idea is they don't get synced.

*/


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
	for (var i = this.children.length - 1; i >= 0; i--) {
		var child = this.children[i];
		this.length += (child.length ? child.length : 1);
		if (child instanceof Attrib)
			this[child.attrib] = child.value;
	};
}
Node.prototype.toJSON = function() {
	return {
		type: this.className,
		id: this.id,
		children: this.children,
	};
};
Node.prototype.rpn = function(_start, _end, _level, _lin) {
	var lin = _lin || [];
	var start = (_start === UNDEFINED) ? 0 : _start;
	var end = (_end === UNDEFINED) ? this.length : _end;
	var level = (_level === UNDEFINED) ? 0 : _level;
	if (level >= this.level && start <= 0 && end >= this.length) {
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
			if (child.rpn) child.rpn(s, end - offset, level, lin);
			else if (child.slice) lin.push(child.slice(s, end - offset));
			else lin.push(child);
		}
		offset += cl;
	};
	if (end >= this.length && start < this.length)
		lin.push(new TypeSpec(this.className, this.id));
	return lin;
};
Node.prototype.maxId = function() {
	if (this._maxId === UNDEFINED) {
		var m = this.id;
		for (var i = this.children.length - 1; i >= 0; i--) {
			var child = this.children[i];
			if (child.maxId) {
				var mid = child.maxId();
				if (mid > m) m = mid;
			}
		};
		this._maxId = m;
	}
	return this._maxId;
}
Node.prototype.className = "Node";
Node.prototype.level     = 0;

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
P.prototype                    = new Node();
H1.prototype                   = new Node();
H2.prototype                   = new Node();
H3.prototype                   = new Node();
Quote.prototype                = new Node();
PullQuote.prototype            = new Node();
Ulli.prototype                 = new Node();
Olli.prototype                 = new Node();
Code.prototype                 = new Node();
Figure.prototype               = new Node();
FigCaption.prototype           = new Node();
Table.prototype                = new Node();
THead.prototype                = new Node();
TBody.prototype                = new Node();
TFoot.prototype                = new Node();
Row.prototype                  = new Node();
Cell.prototype                 = new Node();
Image.prototype                = new Node();

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
	}

	for (var i = 0; i < ops.ops.length; i++) {
		var op = ops.ops[i];
		if (ops.isRetain(op)) {
			lin = doc.rpn(offset, offset + op.n, level(stack[stack.length - 1]));
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