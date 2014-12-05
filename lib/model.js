/*

INVARIANTS

* Must have newline and cell separator characters as
  you can place a cursor either side of them.

  -- separators (they are not part of either the cell or the paragraph)

* Don\'t have to split on newline characters. Can put attributes into the document
  to say what they are.

*/

var operations = require('./operations');

var Retain       = operations.Retain,
    Mark         = operations.Mark,
    Skip         = operations.Skip,
    UnMark       = operationsUnMark,
    EndMark      = operationsEndMark,
    UnEndMark    = operationsUnEndMark,
    Skip         = operationsSkip;

var UNDEFINED;

//Treat elements as immutable so all methods can be memoized
function Element(klass, options) {
	options = options || {};
	this.type = options.type || 'element';
	this._attribute = options.attribute || this.type;
	//this.children = []; //MUST BE IN SUBCLASS

	Element._constructors = Element._constructors || {}
	Element._constructors[this.type] = klass;

	this.klass = klass;
}
Element.prototype.init = function() {
	this.calculateLength();
};
Element.prototype.calculateLength = function() {
	var acc = 0;
	for (var i = this.children.length - 1; i >= 0; i--) {
		acc += this.children[i].length;
	};
	this.length = acc;
	return this.length;
};
Element.prototype.textContent = function() {
	if (this._textContent === UNDEFINED) {
		this._textContent = this.children.map(function(c) {
			return (typeof c === 'string'? c : c.textContent());
		}).join('');
	}
	return this._textContent;
}
Element.prototype.toJSON = function() {
	var ret = {};
	ret.type = this.type;
	for(var k in this) {
		if (this.hasOwnProperty(k) && !(/^_/.test(k)) && k !== 'length')
			ret[k] = this[k];
	}
	return ret;
};
Element.prototype.operationsForRange = function(start, end, ops) {
	ops = ops || [];
	if (start <= 0) {
		if (end > this.length) {
			ops.push(this); 
			return ops; //range covers whole element
		} else if (end > 0) {
			//push down
			ops.push(new Mark(this._attribute, this.options, this.type))
		}
	}
	var cursor = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		var len = end - cursor;
		if (len < 0) break;
		//skip elements before start
		if (cursor + child.length >= start) {
			if (cursor >= start && child.length < len) {
				ops.push(child);
			} else if (typeof child === 'string') {
				if (end > cursor) {
					var offset = start > cursor ? start - cursor : 0;
					if (offset < child.length) ops.push(child.slice(offset,len));
				}
			} else {
				child.operationsForRange(start - cursor, len, ops);
			}
		}
		cursor += child.length;
	};
	if (end > this.length) {
		//pop up
		ops.push(new EndMark(this._attribute));
	}
	return ops;
};
Element.prototype.apply = function(ops) {
	return apply(this, ops);
};


//first fragment in a document is main content.
function Document(fragments, options) { this.children = fragments || []; if (options) this.options = options; this.init(); }
function Fragment(sections, options) { this.children = sections || []; if (options) this.options = options; this.init(); }
function Section(paragraphs, options) { this.children = paragraphs || []; if (options) this.options = options; this.init(); }
function P(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Header(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Quote(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Ulli(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Olli(spans, opitons) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Code(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Figure(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Table(rows, options) { this.children = rows || []; if (options) this.options = options; this.init(); }
function Row(cells, options) { this.children = cells || []; if (options) this.options = options; this.init(); }
function Cell(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Link(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Strong(spans) { this.children = spans || []; this.init(); }
function Em(spans) { this.children = spans || []; this.init(); }
function Sub(spans) { this.children = spans || []; this.init(); }
function Sup(spans) { this.children = spans || []; this.init(); }

Document.prototype = new Element(Document, {type: 'document'});
Fragment.prototype = new Element(Fragment, {type: 'fragment'});
Section.prototype = new Element(Section, {type: 'section'});
P.prototype = new Element(P, {type: 'p', attribute: 'paragraph'});
Header.prototype = new Element(Header, {type: 'header', attribute: 'paragraph'});
Quote.prototype = new Element(Quote, {type: 'quote',attribute: 'paragraph'});
Ulli.prototype = new Element(Ulli, {type: 'ulli', attribute: 'paragraph'});
Olli.prototype = new Element(Olli, {type: 'olli', attribute: 'paragraph'});
Figure.prototype = new Element(Figure, {type: 'figure', attribute: 'paragraph'});
Code.prototype = new Element(Code, {type: 'code', attribute: 'paragraph'});
Table.prototype = new Element(Table, {type: 'table', attribute: 'paragraph'});
Row.prototype = new Element(Row, {type: 'row'});
Cell.prototype = new Element(Cell, {type: 'cell'});
Link.prototype = new Element(Link, {type: 'link'});
Strong.prototype = new Element(Strong, {type: 'strong'});
Em.prototype = new Element(Em, {type: 'em'});
Sub.prototype = new Element(Sub, {type: 'sub', attribute: 'supb'});
Sup.prototype = new Element(Sup, {type: 'sup', attribute: 'supb'});

var LEVELS = {
	supb: 2,
	em: 3,
	strong: 4,
	link: 5,
	cell: 47,
	row: 48,
	paragraph: 50,
	section: 80,
	fragment: 90,
	document: 100,
};

var shouldMerge = {
	supb: true,
	em: true,
	strong: true,
	link: true,
};

var Constructors = Element._constructors;

function apply(doc, opsO) {
	var ops = [];
	var chunks = [];
	var stack = [];
	var level = 10000; //sentinel level
	var op;
	var cursor = 0;
	var unMarks = {};
	var unEndMarks = {};
	unMarks.length = 0;
	unEndMarks.length = 0;
	var marks = {};
	var endMarks = {};

	function endMark(attribute) {
		var yard = [];
		var n;
		var klass;
		var tl = stack.pop();
		while(tl.op.attribute !== attribute) {
			klass = Constructors[tl.op.type || tl.op.attribute];
			n = new klass(chunks, tl.op.options);
			chunks = tl.chunks;
			chunks.push(n);
			yard.push(tl);
			tl = stack.pop();
		};
		klass = Constructors[tl.op.type || tl.op.attribute];
		n = new klass(chunks, tl.op.options);
		chunks = tl.chunks
		chunks.push(n);
		level = tl.level;
		while(tl = yard.pop()) {
			op = tl.op;
			stack.push({op: op, chunks: chunks, level: level});
			level = tl.level;
			chunks = [];
		}
	}

	function mark(op) {
		var yard = [];
		var n, klass;
		var nl = LEVELS[op.attribute];
		while (nl >= level) {
			tl = stack.pop();
			level = tl.level;
			if (chunks.length > 0) {
				klass = Constructors[tl.op.type || tl.op.attribute];
				n = new klass(chunks, tl.op.options);
				chunks = tl.chunks;
				chunks.push(n);
			} else {
				chunks = tl.chunks;
			}
			
			yard.push(tl);
		}
		stack.push({op: op, chunks: chunks, level: level});
		chunks = [];
		level = nl;
		while(tl = yard.pop()) {
			op = tl.op;
			stack.push({op: op, chunks: chunks, level: level});
			level = tl.level;
			chunks = [];
		}
	}

	function processMarks() {
		if (unMarks.length > 0)
			throw "UnMark with no matching mark";
		if (unEndMarks.length > 0)
			throw "UnEndMark with no matching endMark";
		//do endMarks
		for (var attribute in endMarks) {
			if (endMarks.hasOwnProperty(attribute)) {
				endMark(attribute);
			}
		}
		endMarks = {};
		//do marks
		for (var attribute in marks) {
			if (marks.hasOwnProperty(attribute)) {
				mark(marks[attribute]);
			}
		}
		marks = {};
	}

	//expand all the retains.
	for (var i = 0; i < opsO.length; i++) {
		op = opsO[i];
		if (op instanceof Retain) {
			var nops = doc.operationsForRange(cursor, cursor + op.n);
			for (var j = 0; j < nops.length; j++) {
				ops.push(nops[j]);
			};
			cursor += op.n;
		} else if (op instanceof Skip) {
			//all the Mark and EndMarks need to net off.
			var nops = doc.operationsForRange(cursor, cursor + op.str.length);
			for (var j = 0; j < nops.length; j++) {
				if (nops[j] instanceof Mark || nops[j] instanceof EndMark)
					ops.push(nops[j]);
			};
			cursor += op.str.length;
		} else {
			ops.push(op);
		}
	};

	for (var i = 0; i < ops.length; i++) {
		op = ops[i];
		//keep track of all the marks and unmarks
		// but only actually process them when we move
		// the cursor on. That we we can cancel them out
		// when they match off.
		// TODO: this doesn't really work for 
		// unMark then mark...
		if (op instanceof Mark) {
			if (unMarks[op.attribute] && 
				unMarks[op.attribute].options === op.options) {
				delete unMarks[op.attribute];
				unMarks.length -= 1;
			} else if (endMarks[op.attribute] && shouldMerge[op.attribute]) {
				delete endMarks[op.attribute];
			} else if (marks[op.attribute]) {
				throw "Mark " + op.attribute + " already set."
			} else {
				marks[op.attribute] = op;
			}
		} else if (op instanceof UnMark) {
			if (marks[op.attribute] && 
				marks[op.attribute].options === op.options) {
				delete marks[op.attribute];
			} else if (unMarks[op.attribute]) {
				throw "UnMark " + op.attribute + " already set.";
			} else {
				unMarks[op.attribute] = op;
				unMarks.length += 1;
			}
		} else if (op instanceof UnEndMark) {
			if (endMarks[op.attribute]) {
				delete endMarks[op.attribute];
			} else if (unEndMarks[op.attribute]) {
				throw "UnEndMark " + op.attribute + " already set.";
			} else {
				unEndMarks[op.attribute] = op;
				unEndMarks.length += 1;
			}
		} else if (op instanceof EndMark) {
			if (unEndMarks[op.attribute]) {
				delete unEndMarks[op.attribute];
				unEndMarks.length -= 1;
			} else if (marks[op.attribute] && shouldMerge[op.attribute]) {
				delete marks[op.attribute];
			} else if (endMarks[op.attribute]) {
				throw "EndMark " + op.attribute + " already set."
			} else {
				endMarks[op.attribute] = op;
			}
		} else {
			processMarks();
			if (op instanceof Insert) {
				if (typeof chunks[chunks.length - 1] === 'string' &&
					!(chunks.length === 1 && 
						(chunks[0] === '\n' || chunks[0] === '\t')))
					chunks[chunks.length - 1] += op.str;
				else
					chunks.push(op.str);
			} else {
				if (typeof op === 'string' && 
					typeof chunks[chunks.length - 1] === 'string' &&
					!(chunks.length === 1 && 
						(chunks[0] === '\n' || chunks[0] === '\t')))
					chunks[chunks.length - 1] += op;
				else
					chunks.push(op);
			}
		}
	};

	processMarks();

	if (stack.length > 0) throw "Non empty stack at end of apply";

	return chunks[0];
};

module.exports = {
	Element:      Element,
	Document:     Document,
	Fragment:     Fragment,
	Section:      Section,
	P:            P, 
	Header:       Header,
	Quote:        Quote,
	Ulli:         Ulli,
	Olli:         Olli,
	Figure:       Figure,
	Code:         Code,
	Table:        Table,
	Row:          Row,
	Cell:         Cell,
	Link:         Link,
	Strong:       Strong,
	Em:           Em,
	Sub:          Sub,
	Sup:          Sup,
};