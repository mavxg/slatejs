var ot = require('ot-sexpr');
var ql = require('qube');

var lex = ql.lex;
var parse = ql.parse;

var List = ot.List;
var AttributedString = ot.AttributedString;
var Visitor = ot.Visitor;
var _sym = ot.sym;

var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var Selection = ot.Selection;
var Region = ot.Region;

var render = require('../render');
var renderChildren = render.renderChildren;
var renderers = render.renderers;

var keyToId = require('../ids').keyToId;

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

function _import_expressions(node) {
	if (node.values.length < 3) return [];
	var imported = node.values[1];
	var ret = imported.qube_expressions();
	var url = node.values[2].textContent();
	if (/ +as +/.test(url)) {
		var namespace = url.split(/ +as +/)[1].trim();
		var nret = ['Namespace', sym(namespace)];
		Array.prototype.push.apply(nret, ret);
		ret = nret;
		ret.context = {node:node.id, type:'import'};
		return [ret];
	} else {
		return ret;
	}
}

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
	var seq = 0;
	var context = function(){ 
		return {node:me.id,
			type:'table',
			hash:(me.id + '_' + (++seq))
		}; 
	};
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
	var outputColumns = [];
	var outputExpressions = {};

	function error(msg) {
		var err = ['Error', msg];
		err.context = context();
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
		} else if ((match = cell.match(/^ *(`.*`) *$/))) {
			me._has_results = true; //we have an output column
			outputColumns.push(col);
			outputExpressions[col] = match[1];
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
			expr.context = context();
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
				expr.context = context();
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

			//Add key testing
			for (var kcol in keys) {
				var key = keys[kcol];
				kcol = +kcol; //turn kcol into a number
				var s = sym(key);
				var negone = numOrStr(-1);
				body.forEach(function(row) {
					var cell = row.values[kcol+1];
					cell._has_results = true;
					row._has_results = true;
					var cont = cell.textContent();
					if (cont === '') return;
					var expr = numOrStr(cont);
					expr = ['Greater', ['IndexOf', s, expr], negone];
					expr.context = {node:cell.id, type:'key_test'};
					sexpr.push(expr);
				});
			}

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
						var ctx;
						if (/ *=/.test(mexpr)) {
							mexpr = mexpr.replace(/ *= */, '');
							expr = safe_parse(mexpr);
							ctx = expr.context = {node:cell.id, type:'cell_formula'};
						} else {
							expr = numOrStr(mexpr);
							ctx = expr.context = {node:cell.id, type:'cell'};
						}
						var originalSexpr = expr;
						//TODO add column predicates
						for (var kcol in keys) {
							var key = keys[kcol];
							kcol = +kcol; //turn kcol into a number
							var cont = row.values[1+kcol].textContent();
							if (cont !== '')
								expr = ['LetG', sym(key), numOrStr(cont), expr];
						}
						expr  = ['Set', cubeSym, expr];
						//set orriginal Sexpr to just the cell content
						//so that we can figure out what to replace.
						expr.originalSexpr = originalSexpr;
						expr.context = ctx;
						sexpr.push(expr);
					} catch (e) {
						errors.push(error(e.toString()));
					}
				});
			});
			outputColumns.forEach(function(col) {
				var mexpr = outputExpressions[col];
				var bexpr = safe_parse(mexpr);
				body.forEach(function(row) {
					row._has_results = true;
					try {
						var cell = row.values[1+col];
						cell._has_results = true;
						var expr = bexpr;
						for (var kcol in keys) {
							var key = keys[kcol];
							kcol = +kcol; //turn kcol into a number
							var cont = row.values[1+kcol].textContent();
							if (cont !== '')
								expr = ['LetS', sym(key), numOrStr(cont), expr];
						}
						expr.context = {node:cell.id, type:'cell_output'};
						//if we have no keys then we don't output
						if (expr !== bexpr) sexpr.push(expr);
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
	var seq = 0;
	var offset = 1;
	for (var i = 0; i < chunks.length; i++) {
		var chunk = chunks[i];
		if (chunk.attributes.code) { //TODO: do we want to make this a
			var expr = safe_parse(chunk.str); //assume we get one expression
			expr.context = {node:node.id,
				type:'inline',
				index:index,
				offset:offset,
				hash:(node.id + '_' + (++seq)),
			};
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
	if (this._has_results === undefined) this._has_results = false;
	switch (this.head().sym) {
		case 'code':
			this._qube_expressions = _code_expressions(this);
			break;
		case 'table':
			this._qube_expressions = _table_expressions(this); //will set this._has
			break;
		case 'import':
			this._qube_expressions = _import_expressions(this);
			break;
		case 'result':
			this._has_results = true;
			this._is_result = true;
			this._qube_expressions = []; //TODO: unless Cache type.
			break
		default:
			var rets = [];
			var prev;
			this.values.forEach(function(x,i) {
				if (typeof x.qube_expressions === 'function') {
					var xs = x.qube_expressions(me, i);
					if (x._has_results) this._has_results = true;
					if (x._is_result &&
						prev &&
						prev.id &&
						prev.head().sym !== 'result') {
						//results steal cells from above
						xs = []; //don't put them on the result object
						//or they cache badly
						var pid = prev.id;
						var prevs = rets.pop();
						var leaves = [];
						prevs.forEach(function(p) {
							if (p.context.node === pid &&
								!p.context.index) {
								var np = p.slice(0);
								np.context = {node:x.id,
									type:p.context.type, from:pid, hash:(p.context.hash || pid)};
								xs.push(np);
							} else {
								leaves.push(p);
							}
						})

					}
					rets.push(xs);
					prev = x;
				}
			});
			this._qube_expressions = [].concat.apply([],rets);
	}
	return this._qube_expressions;
};
List.prototype.has_results = function() {
	var me = this;
	if (this._has_results !== undefined) return this._has_results;
	this.qube_expressions(); //ensure this is run first
	return this._has_results;
};

function _error(msg) {
	var err = new List();
	err.push(_sym('error'));
	err.push(new AttributedString(msg));
	return err;
}

function _cell(v, ats) {
	var c = new List(false, ats);
	c.push(_sym('cell'));
	c.push(map_result(v));
	return c;
}

function _row(cs) {
	var r = new List();
	r.push(_sym('row'));
	cs.forEach(function(c) {
		r.push(c);
	});
	return r;
}

function map_list_result(a) {
	var r = new List(false, (a.headers ? {headerRows:1} : {}));
	r.push(_sym('table'));
	var attributes = {}
	if (a.headers && a.dimensions && a.headers[0] === a.dimensions[0])
		attributes.className = 'category';
	if (a.headers)
		r.push(_row([_cell(a.headers[0],attributes)]));
	a.forEach(function(v) {
		r.push(_row([_cell(v,attributes)]));
	});
	return r;
}

function map_table_result(a) {
	var r = new List(false, (a.headers ? {headerRows:1} : {}));
	r.push(_sym('table'));
	var attributes = []
	if (a.headers) {
		var cs = [];
		a.headers.forEach(function(h) {
			var ats = (a.dimensions.indexOf(h) >= 0) ?
				{className:'category'} : {};
			attributes.push(ats);
			cs.push(_cell(h,ats));
		});
		r.push(_row(cs));
	}
	function _map_cell(v, i) {
		return _cell(v,attributes[i])
	}
	a.forEach(function(vs) {
		r.push(_row(vs.map(_map_cell)));
	});
	return r;

}

function map_result(res) {
	if (res === undefined || res === null) {
		return new AttributedString("");
	} if (typeof res === 'number' || res instanceof Number) {
		return new AttributedString(res.toString());
	} else if (typeof res === 'string' || res instanceof String) {
		return new AttributedString(res);
	} else if (Array.isArray(res) && res.length > 0) {
		return Array.isArray(res[0]) ?
			map_table_result(res) :
			map_list_result(res);
	} else if (res instanceof Element) {
		var r = new List();
		r.push(_sym('html'))
		r.push({html:res.outerHTML});
		return r;
	}
	return new AttributedString(JSON.stringify(res));
}

var _result = _sym('result');
function map_outs(results) {
	var r = new List();
	r.push(_result);
	while ((cell = results.pop())) {
		if (cell.errors.length > 0) {
			for (var i=0;i<cell.errors.length; i++)
				r.push(_error(cell.errors[i]));
		} else {
			try {
				var x = map_result(cell.result());
				if (!(x instanceof List)) {
					var n = new List();
					n.push(_sym('pre'));
					n.push(x);
					x = n;
				}
				r.push(x);
			} catch(e) {
				r.push(_error(e.toString()));
			}
		}
	}
	return r;
}


function objectEquals(x, y) {
    'use strict';

    if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
    // after this just checking type of one would be enough
    if (x.constructor !== y.constructor) { return false; }
    // if they are functions, they should exactly refer to same one (because of closures)
    if (x instanceof Function) { return x === y; }
    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (x instanceof RegExp) { return x === y; }
    if (x === y || x.valueOf() === y.valueOf()) { return true; }
    if (Array.isArray(x) && x.length !== y.length) { return false; }

    // if they are dates, they must had equal valueOf
    if (x instanceof Date) { return false; }

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) { return false; }
    if (!(y instanceof Object)) { return false; }

    // recursive object equality check
    var p = Object.keys(x);
    return Object.keys(y).every(function (i) { 
    	return p.indexOf(i) !== -1; }) &&
        p.every(function (i) { return objectEquals(x[i], y[i]); });
}

//traverse document generating required ops to replace
//results with new results
List.prototype.replace_results = function(ops, results) {
	var exprs = this.qube_expressions();
	if (exprs.length === 0 && !(this.has_results())) {
		ops.push(ot.operations.retain(this.size));
		return;
	}

	function _push(op) { ops.push(op); }

	function _changed(out) { return !!out.changed; }

	var outs = results[this.id];
	switch (this.head().sym) {
		case 'result':
			if (outs === undefined) {
				//delete the result -- not needed
				this.prefix(0, this.size,
					ot.operations.delete).forEach(_push);
				return;
			}
			if (outs.some(_changed)) {
				//TODO: ... diff results.
				//replace result content
				ops.push(ot.operations.retain(2));
				//generate new results
				var nr = map_outs(outs);
				//delete old results
				this.prefix(2, this.size-1,
					ot.operations.delete).forEach(_push);
				//insert new results
				nr.prefix(2, nr.size-1).forEach(_push);
				ops.push(ot.operations.retain(1));
			} else {
				//nothing has changed
				ops.push(ot.operations.retain(this.size));
			}
			return;
		case 'cell':
			var errors = [];
			var res;
			if (outs && outs.length >= 1) {
				var out = outs[0];
				if (out.errors.length > 0) {
					errors = out.errors;
				} else if (out.context.type === 'key_test') {
					if (out.result() === false) {
						errors.push('Invalid key');
					}
				} else if (out.changed) {
					res = new List();
					res.push(map_result(out.result()));
				}
			}
			var unattributes;
			var attributes;
			if (this.attributes && this.attributes.errors)
				unattributes = {errors:this.attributes.errors};
			if (errors.length > 0)
				attributes = {errors:errors};
			if (!objectEquals(attributes, unattributes)) {
				ops.push(ot.operations.retain(1,attributes,unattributes));
				ops.push(ot.operations.retain(1));
			} else {
				ops.push(ot.operations.retain(2));
			}
			if (res !== undefined) {
				//replace content //TODO: merge
				this.prefix(2, this.size-1,
					ot.operations.delete).forEach(_push);
				res.prefix(1,res.size-1).forEach(_push);
			} else {
				ops.push(ot.operations.retain(this.size-3));
			}
			ops.push(ot.operations.retain(1));
			return;
	}

	ops.push(ot.operations.retain(2)); //push + sym
	for (var i = 1; i < this.length; i++) {
		var child = this.index(i);
		if (typeof child.replace_results !== 'function') {
			ops.push(ot.operations.retain(1));
			continue;
		}
		child.replace_results(ops, results, this, i);
	}
	ops.push(ot.operations.retain(1)); //pop

	//insert new results
	if (outs && outs.length > 0) {
		var nr = map_outs(outs);
		nr.prefix(0, nr.size).forEach(_push);
	}
};
AttributedString.prototype.replace_results = function(ops, results, node, index) {
	//TODO: splice with results and set outs for any last chunk results.
	ops.push(ot.operations.retain(this.size));
}

/// RENDERERS

//import is runtime
var Import = createClass({
	fetched: function(response) {
		console.log(response);
		var insert = ot.parse(response)[0];
		this.setState({state:'fetched'});
		//insert stuff into the object.
		var obj = this.props.obj;
		var path = this.props.path.slice(0);
		path.push(obj.id);
		var editor = this.props.editor;
		var doc = editor.document();
		var x = doc.nodeByPath(path);
		console.log(x.offset);
		var ops = ot.operations;
		var op = [];
		op.push(ops.retain(x.offset + 2)); //skip past the import
		if (x.node.values.length > 2) {
			//TODO DIFF!!!
			var imp = x.node.values[1];
			op = op.concat(imp.prefix(0,imp.size,ops.delete));
		}
		op = op.concat(insert.prefix(0,insert.size));
		editor.applyLocal(op);
	},
	error: function(error) {
		this.setState({state:'error', error:error});
	},
	download: function(e) {
		e.stopPropagation();
		e.preventDefault();
		console.log('Clicked download');
		this.setState({state:'fetching'});
		var xhr = new XMLHttpRequest();
		
		xhr.withCredentials = true;
		var self = this;

		xhr.onreadystatechange = function() {
			if (this.readyState === this.DONE) {
				if (this.status === 200)
					self.fetched(this.responseText);
				else
					self.error(this.statusText);
			}
		};
		var ps = this.params();
		console.log(ps.url)
		xhr.open("GET", ps.url);
		xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
		xhr.send();
		return false;
	},
	params: function() {
		var obj = this.props.obj;
		var imported = obj.values[1];
		var url;
		var namespace;
		if (imported instanceof List) {
			url = obj.values[2].str;
		} else {
			url = imported.str;
			imported = undefined;
		}
		if (/ +as +/.test(url)) {
			var x = url.split(/ +as +/);
			url = x[0];
			namespace = x[1];
		}
		return {url:url, namespace:namespace, imported:imported};
	},
	render: function() {
		var obj = this.props.obj;
		var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
		var editor = this.props.editor;
		var props = {
			id: keyToId(obj.id),
			className: 'import',
			
		};
		var imported = obj.values[1];
		var url;
		var action_class = 'right-icon';
		var action = this.download;
		var fa_action;
		var title = '';
		var children;
		if (imported instanceof List) {
			fa_action = 'refresh';
			url = obj.values[2];
			children = [{___skip:imported.size}, url]; //need something to skip to get ids right
		} else {
			url = imported;
			imported = undefined;
			fa_action = 'cloud-download';
			children = [url];
		}

		switch (this.state.state) {
			case 'error':
				fa_action = 'exclamation-triangle';
				action_class += ' error';
				title = this.state.error;
				break;
			case 'fetching':
				fa_action = 'spinner';
				action = undefined;
				break;
		}

		var action_elem = DOM.a({
			id: keyToId(obj.id) + ":" + 0 + ":" + (obj.size-3) + "_hr",
			className:action_class,
			title:title,
			onClick: action,
		},[DOM.span({className:'fa fa-' + fa_action},"")]);

		children = renderChildren(children, this.props.selection, obj.id, editor, path);
		children.push(action_elem)
		return DOM.div(props,children);
	}
});

//include is edit time
var Include = createClass({
	fetched: function(response) {
		console.log(response);
		var insert = ot.parse(response)[0];
		this.setState({state:'fetched'});
		//insert stuff into the object.
		var obj = this.props.obj;
		var path = this.props.path.slice(0);
		path.push(obj.id);
		var editor = this.props.editor;
		var doc = editor.document();
		var x = doc.nodeByPath(path);
		console.log(x.offset);
		var ops = ot.operations;
		var op = [];
		op.push(ops.retain(x.offset + 2)); //skip past the import
		if (x.node.values.length > 2) {
			//TODO DIFF!!!
			var imp = x.node.values[1];
			op = op.concat(imp.prefix(0,imp.size,ops.delete));
		}
		op = op.concat(insert.prefix(0,insert.size));
		editor.applyLocal(op);
	},
	error: function(error) {
		this.setState({state:'error', error:error});
	},
	download: function(e) {
		e.stopPropagation();
		e.preventDefault();
		console.log('Clicked download');
		this.setState({state:'fetching'});
		var xhr = new XMLHttpRequest();
		xhr.withCredentials = true;
		var self = this;

		xhr.onreadystatechange = function() {
			if (this.readyState === this.DONE) {
				if (this.status === 200)
					self.fetched(this.responseText);
				else
					self.error(this.statusText);
			}
		};
		var ps = this.params();
		console.log(ps.url)
		xhr.open("GET", ps.url);
		xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
		xhr.send();
		return false;
	},
	params: function() {
		var obj = this.props.obj;
		var imported = obj.values[1];
		var url;
		var namespace;
		if (imported instanceof List) {
			url = obj.values[2].str;
		} else {
			url = imported.str;
			imported = undefined;
		}
		if (/ +as +/.test(url)) {
			var x = url.split(/ +as +/);
			url = x[0];
			namespace = x[1];
		}
		return {url:url, namespace:namespace, imported:imported};
	},
	render: function() {
		var obj = this.props.obj;
		var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
		var editor = this.props.editor;
		var props = {
			id: keyToId(obj.id),
			className: 'include',
			
		};
		var imported = obj.values[1];
		var url;
		var action_class = 'right-icon';
		var action = this.download;
		var fa_action;
		var title = '';
		var children;
		if (imported instanceof List) {
			fa_action = 'refresh';
			url = obj.values[2];
			children = [{___skip:imported.size}, url]; //need something to skip to get ids right
		} else {
			url = imported;
			imported = undefined;
			fa_action = 'cloud-download';
			children = [url];
		}

		switch (this.state.state) {
			case 'error':
				fa_action = 'exclamation-triangle';
				action_class += ' error';
				title = this.state.error;
				break;
			case 'fetching':
				fa_action = 'spinner';
				action = undefined;
				break;
		}

		var action_elem = DOM.a({
			id: keyToId(obj.id) + ":" + 0 + ":" + (obj.size-3) + "_hr",
			className:action_class,
			title:title,
			onClick: action,
		},[DOM.span({className:'fa fa-' + fa_action},"")]);

		children = renderChildren(children, this.props.selection, obj.id, editor, path);
		children.push(action_elem)
		return DOM.div(props,children);
	}
});

//register renderers
renderers.include = Include;
renderers.import = Import;


// END RENDERERS


var keymap = [
	{keys:["space"], command:"style", args:{style:"include", remove:"@include"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"@include", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"import", remove:"@import"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"@import", match_all:true},
		]},
	{keys:["enter"], command:"break", args:{type:"line", style:"p"},
		context:[
			{key:"head", operator:"in", operand:["include","import"], match_all:true}
		]},
	{keys:["esc"], command:"recalculate"},
];

module.exports = function(editor) {
	if (editor.state.qube_auto === undefined)
		editor.state.qube_auto = true;
	var dirty = true;
	var ignore = false;
	var expressions = [];

	var qube = new ql.Qube(ql.prelude);

	function _push(ops, op) {
		ot._push(ops, op);
		return ops;
	}

	function replace_results(results) {
		console.log(results.length + ' results have changed');
		if (results.length === 0) return;
		var ops = [];
		var doc = editor.document();

		var results_hash = {};
		results.forEach(function(cell) {
			if ((cell.isExpression || cell.errors.length > 0) &&
				cell.context.node) {
				var k = cell.context.node;
				if (!results_hash[k]) results_hash[k] = [];
				results_hash[k].push(cell);
			}
		});

		console.log(results_hash);

		doc.replace_results(ops, results_hash);
		//shrink ops
		ops = ops.reduce(_push, []);
		//don't trigger a recalc
		ignore = true;
		//console.log(editor.document().toSexpr())
		editor.applyLocal(ops);
	}

	function recalculate() {
		console.log('recalculate');
		expressions = editor.document().qube_expressions();
		replace_results(qube.merge(expressions));
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
					op.type === 'push' && op.value === 'string') {
					recalculate();
					break;
				}
			}
		}
	}

	function onselect(ops) {
		if (dirty && editor.state.qube_auto) {
			recalculate();
		}
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