var ot = require('ot-sexpr');
var ql = require('qube');

var lex = ql.lex;
var parse = ql.parse;

var List = ot.List;
var AttributedString = ot.AttributedString;
var Visitor = ot.Visitor;
var _sym = ot.sym;

//From Cube
function sym() {
	var symb = ['Symbol'];
	Array.prototype.push.apply(symb, arguments);
	return symb;
}

function str(strn) {
	return ['String', strn];
}

function num(numb) {
	return ['Number', numb];
}


function numOrStr(nos) {
	var numb = +nos;
	if (isNaN(numb)) {
		return ['String', nos];
	}
	return ['Number', numb];
}
//END from Cube

AttributedString.prototype.textContent = function() {
	return this.str;
};
List.prototype.textContent = function() {
	if (!this._textContent) {
		var ts = [];
		this.values.forEach(function(x) {
			if (typeof x.textContent === 'function')
				ts.push(x.textContent());
		});
		this._textContent = ts.join(' '); //space or not?
	}
	return this._textContent;
};

function _code_expressions(node) {
	var raw = node.textContent();
	var expr = safe_parse(raw);
	if (expr === undefined) return [];
	expr.context = {node:node.id, type:'code'};
	return [expr]
}

function _table_expressions(me) {
	if (!me.attributes || me.attributes.headerRows !== 1) return [];
	//check type (i.e row based, key based, with formulas)
	var sexpr = [];
	var context = {node:me.id, type:'table'};
	var errors = [];
	var modelColumns = [];
	var keys = {};
	var predicates = {};
	var cubeNames = {};
	var keyNames = [];
	var cubeColumns = [];
	var categoryColumns = [];
	var isCategoryColumn = [];
	var rows = me.values.slice(1); //assuming no columngroup
	var header = rows[0].values.slice(1); //header cells

	function error(msg) {
		var err = ['Error', msg];
		err.context = context;
		return err;
	}

	// sym[]=, sym=, sym[predicate?]
	header.forEach(function(cell_node, col) {
		var cell = cell_node.textContent();
		var match = cell.match(/ *([^\[\]]+)\[\]= *$/);
		if (match) {
			keys[col] = match[1];
			keyNames.push(match[1]);
			modelColumns.push(col);
			categoryColumns.push(col);
			isCategoryColumn[col] = true;
		} else if ((match = cell.match(/ *([^\]]+)= *$/))) {
			me._has_results = true;
			keys[col] = match[1];
			keyNames.push(match[1]);
			modelColumns.push(col);
		} else if ((match = cell.match(/^ *`(.*)` *$/))) {
			me._has_results = true; //we have an output column
		} else if ((match = cell.match(/^\s*(.*)\[([^\]]*)\] *$/))) {
			modelColumns.push(col);
			cubeColumns.push(col);
			predicates[col] = match[2];
			cubeNames[col] = match[1];
			//todo check for non row based predicate
		}
	});

	if (modelColumns.length > 0) {
		var formulaColumns = [];
		modelColumns.forEach(function(col) {
			var hasFormula = rows.some(function(row) {
				return /^ *=/.test(row.values[1+col].textContent());
			});
			if (hasFormula) formulaColumns.push(col);
			if (isCategoryColumn[col])
				return [error('Category definition column cannot contain formulas')];
		});
		var hasFormulas = formulaColumns.length > 0;
		
		var isRowBased = keyNames.length === 0;

		//Compile the table.
		//Don't support functions in key based columns if the
		//key is being defined by the table.

		//Don't support Row keyed tables with formulas.
		if (isRowBased && hasFormulas) {
			return [error('A Row keyed table column cannot contain formulas')];
		} else if (isRowBased) {
			//assume all the predicates are the same (or only the first has anything in)
			var catName = predicates[cubeColumns[0]];

			var body = rows.slice(1);
			var expr = ['Category', sym(catName),
					['Call', sym('range'), num(rows.length - 1)]];
			expr.context = context;
			sexpr.push(expr)
			//define Cubes for cubeColumns
			cubeColumns.forEach(function(col) {
				var cubeName = cubeNames[col];
				var values = ['List'];

				body.forEach(function(row) {
					values.push(numOrStr(row.values[1+col].textContent()));
				});

				var expr = ['Set', sym(cubeName), //TODO (check if we have a namespace on the column)
					['Indexed', values, ['Index', sym(catName)]]];
				expr.context = context;
				sexpr.push(expr);
			});
		} else {
			//when we come to define the key (not here*) we need to
			// assert it doesn't have any formulas if we want the 
			// table to be where the key is defined
			//* wait until end to see if the key is defined outside
			// of the table so we don't attempt to define it twice.
			/*
			(Set (Symbol Main Description)
			     (LetG (Symbol Portfolio)
			     	   (Symbol Equity)
			     	   (String Equities)))
			 (Set (Symbol Main Weight)
			      (LetG (Symbol Portfolio) 
			            (Symbol Equity) 
			            (Number 0.6)))
			(Category (Symbol Main Portfolio) (List (Symbol Equity)))
			*/
			var body = rows.slice(1);

			//category definitions 
			// (Category (Symbol Portfolio) (List (Symbol Equity) ...))
			categoryColumns.forEach(function(col) {
				var values = ['List'];
				body.forEach(function(row) {
					var cell = row.values[col+1];
					var expr = numOrStr(cell.textContent());
					expr.context = {node:cell.id, type:'cell'};
					values.push(expr);
				});
				var expr = ['Category', sym(keys[col]), values];
				expr.context = context;
				sexpr.push(expr);
			});
			cubeColumns.forEach(function(col) {
				var cubeName = cubeNames[col].split('.');
				var cubeSym = (cubeName.length === 1) ? 
					sym(cubeName[0]) :
					sym.apply(this, cubeName);
				body.forEach(function(row) {
					//TODO: need to check if the column has predicates
					try {
						var cell = row.values[1+col];
						var mexpr = (cell.textContent() || '');
						var expr;
						if (/ *=/.test(mexpr)) {
							mexpr = mexpr.replace(/ *= */, '');
							expr = safe_parse(mexpr);
							expr.context = {node:cell.id, type:'cell_formula'};
						} else {
							expr = numOrStr(mexpr);
							expr.context = {node:cell.id, type:'cell'};
						}
						var originalSexpr = expr;
						//TODO add column predicates
						for (var kcol in keys) {
							var key = keys[kcol];
							kcol = +kcol; //turn kcol into a number
							var cont = row.values[1+kcol].textContent();
							expr = ['LetG', sym(key), numOrStr(cont), expr];
						}
						expr  = ['Set', cubeSym, expr];
						//set orriginal Sexpr to just the cell content
						//so that we can figure out what to replace.
						expr.originalSexpr = originalSexpr;
						expr.context = context;
						sexpr.push(expr);
					} catch (e) {
						errors.push(error(e.toString()));
					}
				});
			});
		}
	}
	if (errors.length > 0) return errors;
	if (sexpr.length > 0) return sexpr;
	return [];
}

function safe_parse(raw) {
	try {
		return parse(lex(raw))[0];
	} catch (e) {
		return ['Error', e.message];
	}
}

AttributedString.prototype.qube_expressions = function(node, index) {
	if (this._qube_expressions) return this._qube_expressions;
	var ret = [];
	var chunks = this.chunk();
	var offset = 1;
	for (var i = 0; i < chunks.length; i++) {
		var chunk = chunks[i];
		if (chunk.attributes.code) { //TODO: do we want to make this a
			var expr = safe_parse(chunk.str); //assume we get one expression
			expr.context = {node:node.id,
				type:'inline',
				index:index,
				offset:offset};
			ret.push(expr);
		}
		offset += chunk.str.length;
	};

	this._qube_expressions = ret;
	return this._qube_expressions;
}
List.prototype.qube_expressions = function() {
	var me = this;
	if (this._qube_expressions) return this._qube_expressions;
	this._has_results = false;
	switch (this.head().sym) {
		case 'code':
			this._qube_expressions = _code_expressions(this);
			break;
		case 'table':
			this._qube_expressions = _table_expressions(this); //will set this._has
			break;
		case 'result':
			this._has_results = true;
			this._qube_expressions = [];
			break
		default:
			var ret = [];
			this.values.forEach(function(x,i) {
				if (typeof x.qube_expressions === 'function') {
					var xs = x.qube_expressions(me, i);
					if (x._has_results) this._has_results = true;
					if (xs.length > 0)
						ret = ret.concat(xs);
				}
			});
			this._qube_expressions = ret;
	}
	return this._qube_expressions;
};
List.prototype.has_results = function() {
	var me = this;
	if (this._has_results !== undefined) return this._has_results;
	this.qube_expressions(); //ensure this is run first
	return this._has_results;
};

function has_changed(old, now) {
	if (old.length !== now.length) return true;
	for (var i=old.length-1;i>=0;i--)
		if (old[i] !== now[i]) return true;
	return false;
} 


module.exports = function(editor) {
	if (editor.state.qube_auto === undefined)
		editor.state.qube_auto = true;
	var dirty = true;
	var ignore = false;
	var expressions = [];

	var qube = new ql.Qube(ql.prelude);
	var cells = [];

	//This needs to be called
	function replace_results() {
		//collect cells with results
		var results = {};
		cells.forEach(function(cell) {
			if ((cell.isExpression || cell.errors.length > 0) && cell.context.node) {
				var k = cell.context.node;
				if (!results[k]) results[k] = [];
				results[k].push(cell);
			}
		});

		var v = new Visitor(editor.document());

		function error(msg) {
			var err = new List();
			err.push(_sym('error'));
			err.push(new AttributedString(msg));
			return err;
		}

		var _result = _sym('result');
		function merge_results_after(results) {
			//create the results
			var r = new List();
			r.push(_result);
			results.forEach(function(cell) {
				console.log(cell)
				if (cell.errors.length > 0) for (var i=0;i<cell.errors.length; i++)
					r.push(error(cell.errors[i]));
				else {
					try {
						r.push(cell.compiled()); //TODO map
					} catch(e) {
						r.push(error(e.toString()));
					}
				}

			});
			var p = v.peekSibling();
			if (p instanceof List && p.head() === _result) {
				//replace results
				//TODO merge..
				p = v.nextSibling();
				v.insert(r.prefix(0,r.size));
				v['delete']();
			} else {
				console.log("attempting insertAfter")
				//insert new results
				v.insertAfter(r.prefix(0,r.size));
			}
		}

		var n=v.next();
		while (n) {
			if (!(n instanceof List)) {
				n = v.next();
				continue;
			}
			var exprs = n.qube_expressions();
			//don't traverse if we don't have anything to do
			if (exprs.length === 0 && !(n.has_results())) {
				n = v.nextSibling() || v.pop(); //along or up;
				continue;
			}
			switch (n.head().sym) {
				case 'code':
					if (results[n.id]) merge_results_after(results[n.id]);
					n = v.nextSibling() || v.pop(); //along or up;
					break;
				case 'table':
					if (n.has_results()) {
						//TODO: conditional format table
						// and put results in.
					}
					if (results[n.id]) merge_results_after(results[n.id]);
					n = v.nextSibling() || v.pop(); //along or up;
					break;
				case 'result':
				case 'error':
					//result/error we don't need anymore
					n = v['delete']();
					break;
				default:
					//inline code somewhere?
					//TODO ... 
					n = v.next();
					break;
			}
		}
		ignore = true; //don't trigger a recalc.
		editor.applyLocal(v.ops);
	}

	function recalculate() {
		console.log('recalculate')
		var old = expressions;
		expressions = editor.document().qube_expressions();
		//check if the expressions have actually changed
		if (has_changed(old, expressions)) {
			console.log('actually recalculating')
			qube.clear();
			cells = qube.exprs(expressions);
			qube.build();
			replace_results();
		}
		dirty = false;
	}
	recalculate.description = function() {
		return "Recalculate model";
	};

	function refresh() {
		//TODO: clear the caches
		recalculate();
	}
	refresh.description = function() {
		return "Refresh imported data and recalculate";
	};

	function autocalculate_on() {
		editor.setState({qube_auto: true});
	}
	autocalculate_on.description = function() {
		return "Turn on auto recalculation";
	};
	autocalculate_on.enabled = function() {
		return !editor.state.qube_auto;
	};

	function autocalculate_off() {
		editor.setState({qube_auto: false});
	}
	autocalculate_off.description = function() {
		return "Turn off auto recalculation";
	};
	autocalculate_off.enabled = function() {
		return editor.state.qube_auto;
	};

	function onapply(ops, ourOp) {
		if (ignore) {
			ignore = false;
			return;
		}
		dirty = true;
		if (editor.state.qube_auto) {
			//check if enter pressed
			for (var i=ops.length-1;i>=0;i--) {
				var op = ops[i];
				if ((op.op === 'insert' || op.op === 'delete') &&
					op.type !== 'char') {
					recalculate();
					break;
				}
			}
		}
	}

	function onselect(ops) {
		if (dirty && editor.state.qube_auto)
			recalculate();
	}

	var commands = {
		recalculate: recalculate,
		refresh: refresh,
		autocalculate_on: autocalculate_on,
		autocalculate_off: autocalculate_off,
	};

	return {
		commands: commands,
		onapply: onapply,
		onselect: onselect,
		keymap: keymap,
	};
};

var keymap = [
	{keys:["esc"], command:"recalculate"},
];