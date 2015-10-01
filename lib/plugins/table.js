//Table commands.
var ot = require('ot-sexpr');
var sym = ot.sym;

var Selection = ot.Selection;
var Region = ot.Region;
var List = ot.List;
var AttributedString = ot.AttributedString;

function commands(editor) {

	function extent(table) {
		var cols = 0;
		var hr = table.values[1];
		var cell = '(cell "")';
		for (var i = hr.values.length - 1; i >= 1; i--) {
			var c = hr.values[i];
			if (c.attributes && c.attributes.colSpan)
				cols += parseInt(c.attributes.colSpan);
			else
				cols++;
		};
		return {columns: cols, rows:(table.values.length - 1)};
	}

	//given a region return the selected table region
	// + point:table start and node
	//assumes the selection start and end are within a table
	function tableSelection(selection) {
		var _selection = selection || editor.selection();
		var doc = editor.document();
		var _table = sym('table');
		var ret = [];
		_selection.forEachR(function(region) {
			var start = region.begin();
			var end = region.end();
			var ns = doc.nodesAt(start);
			var isTable = false;
			var nl;
			//find the table node.
			for (var i = ns.length - 1; i >= 0; i--) {
				nl = ns[i];
				if (nl.type === 'list' && nl.node.head() === _table)
					break;
			};
			if (i <= 0) return; //not a table node
			//check end point is also in node
			if (nl.node.size + nl.point < end) return;

			var text_only = false;
			var leaf = ns[ns.length -1];
			if (leaf.type === 'string' &&
				start > leaf.point &&
				end < leaf.point + leaf.node.size)
				text_only = true;
			//find selected cells.
			var table = nl.node;
			var startCell = _table.cellAt(table, start - nl.point);
			var endCell = _table.cellAt(table, end - nl.point);
			var minCol = Math.min(startCell.column, endCell.column);
			var minRow = Math.min(startCell.row, endCell.row);
			var sAttr = startCell.node.attributes || {};
			var eAttr = endCell.node.attributes || {};
			var maxCol = Math.max(startCell.column + (sAttr.colSpan || 1) - 1,
				endCell.column + (eAttr.colSpan || 1) - 1);
			var maxRow = Math.max(startCell.row + (sAttr.rowSpan || 1) - 1,
				endCell.row + (eAttr.rowSpan || 1) - 1);
			//TODO adjust for col/rowspans in other cells.
			ret.push({node:nl.node, point:nl.point,
					start_row:minRow, start_col:minCol,
					end_row:maxRow, end_col:maxCol, region:region, text_only:text_only});
		});
		return ret;
	}

	function _move_cell(region, forward) {
		var r;
		if (forward)
			r = editor.moveTo(editor.move(
				editor.moveTo(region, 'hardeol'), 'characters', 1, true), 
				'hardeol',true);
		else
			r = editor.moveTo(editor.moveTo(editor.move(
				editor.moveTo(region, 'hardbol'), 'characters', 1, false), 
				'hardbol'),'hardeol',true);
		return r;
		//TODO: check if we are in the last cell or first cell etc.
	}

	function move_cell(args) {
		var forward = args.forward !== false;
		var selection = editor.selection();
		var regions = selection.regions;

		var ns = new Selection(regions.map(function(r) {
			return _move_cell(r, forward);
		}));

		editor.select(ns);
	};
	move_cell.description = function(args) {
		return "Select the contents of the next/previous cell."
	}


	function move(args) {
		console.log("table_move: " + JSON.stringify(args));
	}
	move.description = function(args) {
		return "Move within table";
	};

	function _cellOffset(table, column, row) {
		var offset = 2;
		/*for (var i = 1; i < table.values.length && i <= row; i++) {
			var row = table.values[i];	
			var rn = i-1;
			if (rn === row) {
				for (var j = 1; j<row.values.length; j++) {
					var cell = row.values[j];
					var cn = j-1;
					if (cn >= start_col && cn <= end_col) {
						var op = cell.clearText();
						//console.log(JSON.stringify(op));
						ops = ops.concat(op);
					} else {
						//console.log("retain whole cell: " + row.size);
						push(ot.operations.retain(cell.size));
					}
				}
				break;
			} else {
				offset += row.size;
			}
				//console.log("retain start of row: 2")
				push(ot.operations.retain(2));
				
				//console.log("retain end of row: 1")
				push(ot.operations.retain(1));
			} else {
				//console.log("retain whole row: " + row.size);
				push(ot.operations.retain(row.size));
			}
		}*/

	}

	function _moveTo(r, position, extend, col, row) {
		var doc = editor.document();
		var head = sym('table');
		var na = doc.nodesAt(r.focus);
		for (var i = na.length - 1; i >= 0; i--) {
			var nl = na[i];
			if (nl.type === 'list' && nl.node.head() === head) {
				switch (position) {
					case 'bot':
						return editor.move(
							new Region(nl.point, r.anchor),
							'characters',1,true, extend);
					case 'eot':
						return editor.move(
							new Region(nl.point + nl.node.size, r.anchor),
							'characters',1,false, extend);
					case 'cell':
						//TODO
						var pt = nl.point + _cellOffset(nl.node, col, row)
						if (extend)
							return new Region(pt, r.anchor);
						return new Region(pt);
					default:
						return r;
				};
			}
		};
		return r; //unmoved
	}

	function moveTo(args) {
		var position = args.position || 'bot';
		var extend = args.extend; //should extend selection
		var selection = editor.selection();
		var regions = selection.regions;

		console.log("table_move_to: " + JSON.stringify(args));

		var ns = new Selection(regions.map(function(r) {
			return _moveTo(r, position, extend, args.column, args.row);
		}));

		editor.select(ns);
	}
	moveTo.description = function(args) {
		return "Move to within table";
	};

	function _insert_rows(table, index, n) {
		var hr = table.values[1];
		var cols = 0;
		var cell = '(cell "")';
		for (var i = hr.values.length - 1; i >= 1; i--) {
			var c = hr.values[i];
			if (c.attributes && c.attributes.colSpan)
				cols += parseInt(c.attributes.colSpan);
			else
				cols++;
		};
		var cells = [];
		for (var i=0;i<cols;i++)
			cells.push(cell);
		var row = ot.parse('(row ' + cells.join(' ') + ')')[0];
		var row_ops = row.prefix(0,row.size);

		var retain = 2;
		for (var i=1;i <=index;i++)
			retain += table.values[i].size;
		var ret = [ot.operations.retain(retain)];
		for (var i=0; i<n; i++)
			ret = ret.concat(row_ops);
		return ret;
	}

	function firstString(ops) {
		var n = 0;
		for (var i = 0; i < ops.length; i++) {
			var op = ops[i];
			if (op.op === 'insert' && op.type === 'push' && op.value === 'string') {
				n += 1;
				return n;
			}
			switch (op.op) {
				case 'insert':
				case 'retain':
					n += op.n;
			}
		};
		return;
	}

	function firstDelete(ops) {
		var n = 0;
		for (var i = 0; i < ops.length; i++) {
			var op = ops[i];
			if (op.op === 'delete')
				return n;
			switch (op.op) {
				case 'insert':
				case 'retain':
					n += op.n;
			}
		};
		return;
	}

	function insert_row(args) {
		//insert whole row
		var ts = tableSelection();
		var before = args.before !== false;
		var ops = [];
		var regions = [];
		ts.forEach(function(t) {
			var index = (before ? t.start_row : t.end_row + 1);
			var op = [ot.operations.retain(t.point)];
			_insert_rows(t.node, index, 
				t.end_row - t.start_row + 1
				).forEach(function(o) {
					ot._push(op, o);
				});
			var no = ot.transform(op,ops);
			var x = firstString(no);
			if (x)
				regions.push(new Region(x));
			ops = ot.compose(ops, no);
		});
		editor.apply(ops,new Selection(regions));
	}
	insert_row.description = function(description) {
		return "Insert row";
	};

	function _insert_cols(table, index, n) {
		var cell = ot.parse('(cell "")')[0];
		var cell_ops = cell.prefix(0,cell.size);
		var cells_ops = [];
		for (var i = 0; i < n; i++)
			cells_ops = cells_ops.concat(cell_ops);
		var ret = [ot.operations.retain(2)];
		for (var i = 1; i < table.values.length; i++) {
			var row = table.values[i];
			//retain to first cell
			ot._push(ret, ot.operations.retain(2));
			var retained = 2;
			for (var j = 1; j <= index; j++) {
				var _cell = row.values[j];
				ot._push(ret, ot.operations.retain(_cell.size));
				retained += _cell.size;
			}
			ret = ret.concat(cells_ops);
			//retain to end of row
			ot._push(ret, ot.operations.retain(row.size - retained));
		}
		return ret;
	}

	function insert_column(args) {
		//insert whole column
		var before = args.before !== false;
		var ts = tableSelection();
		var ops = [];
		var regions = [];
		ts.forEach(function(t) {
			var index = (before ? t.start_col : t.end_col + 1);
			var op = [ot.operations.retain(t.point)];
			_insert_cols(t.node, index, 
				t.end_col - t.start_col + 1
				).forEach(function(o) {
					ot._push(op, o);
				});
			var no = ot.transform(op,ops);
			var x = firstString(no);
			if (x)
				regions.push(new Region(x));
			ops = ot.compose(ops, no);
		});
		editor.apply(ops,new Selection(regions));
		//editor.select(new Selection(regions));
	}
	insert_column.description = function(args) {
		return "Insert column";
	};

	//return ops
	function _clearText(table, start_col, start_row, end_col, end_row) {
		var ops = [ot.operations.retain(2)]; //retain to rows
		//console.log('retain start of table: 2')
		function push(op) { ot._push(ops, op); }

		for (var i = 1; i < table.values.length; i++) {
			var row = table.values[i];	
			var rn = i-1;
			if (rn >= start_row && rn <= end_row) {
				//console.log("retain start of row: 2")
				push(ot.operations.retain(2));
				for (var j = 1; j<row.values.length; j++) {
					var cell = row.values[j];
					var cn = j-1;
					if (cn >= start_col && cn <= end_col) {
						var op = cell.clearText();
						//console.log(JSON.stringify(op));
						ops = ops.concat(op);
					} else {
						//console.log("retain whole cell: " + row.size);
						push(ot.operations.retain(cell.size));
					}
				}
				//console.log("retain end of row: 1")
				push(ot.operations.retain(1));
			} else {
				//console.log("retain whole row: " + row.size);
				push(ot.operations.retain(row.size));
			}
		}
		return ops;
	}

	function _deleteColumns(table, start_col, end_col) {
		var ops = [ot.operations.retain(2)]; //retain to rows
		//console.log('retain start of table: 2')
		function push(op) { ot._push(ops, op); }

		for (var i = 1; i < table.values.length; i++) {
			var row = table.values[i];	
			//console.log("retain start of row: 2")
			push(ot.operations.retain(2));
			for (var j = 1; j<row.values.length; j++) {
				var cell = row.values[j];
				var cn = j-1;
				if (cn >= start_col && cn <= end_col) {
					var op = cell.prefix(0,cell.size, ot.operations.delete);
					//console.log(JSON.stringify(op));
					ops = ops.concat(op);
				} else {
					//console.log("retain whole cell: " + row.size);
					push(ot.operations.retain(cell.size));
				}
			}
			//console.log("retain end of row: 1")
			push(ot.operations.retain(1));
		}
		return ops;
	}

	function _deleteRows(table, start_row,end_row) {
		var ops = [ot.operations.retain(2)]; //retain to rows
		for (var i = 1; i < table.values.length; i++) {
			var row = table.values[i];	
			var rn = i-1;
			if (rn >= start_row && rn <= end_row) {
				var op = row.prefix(0,row.size, ot.operations.delete);
				ops = ops.concat(op);
			} else {
				//console.log("retain whole row: " + row.size);
				ot._push(ops, ot.operations.retain(row.size));
			}
		}
		return ops;
	}

	function _delete(args) {
		var ts = tableSelection();
		var doc = editor.document();
		var ops = [];
		var regions = [];
		ts.forEach(function(t) {
			var ext = extent(t.node);
			var op = []
			var all_rows = (t.start_row === 0 && t.end_row >= ext.rows-1);
			var all_cols = (t.start_col === 0 && t.end_col >= ext.columns-1);
			//console.log(JSON.stringify(ext))
			//console.log(t.start_row)
			//console.log(t.end_row)
			if (all_rows && all_cols) {
				//if all the cells are selected then delete table
				op.push(ot.operations.retain(t.point));
				op = op.concat(t.node.prefix(0,t.node.size, ot.operations.delete));
			} else if (all_rows) {
				//if whole column selected delete column
				op.push(ot.operations.retain(t.point));
				op = op.concat(_deleteColumns(t.node, t.start_col, t.end_col));
			} else if (all_cols) {
				//if whole row selected delete rows
				op.push(ot.operations.retain(t.point));
				op = op.concat(_deleteRows(t.node, t.start_row, t.end_row));
			} else if (t.text_only) {
				//delete the selected text
				op = doc.eraseText(t.region);
			} else {
				//else clear cell content.
				console.log("Going to attempt to clear text");
				op.push(ot.operations.retain(t.point));
				op = op.concat(_clearText(
					t.node, t.start_col, t.start_row, t.end_col, t.end_row));
			}
			var no = ot.transform(op,ops);
			regions.push(new Region(firstDelete(no)));
			ops = ot.compose(ops, no);
		});
		//console.log(JSON.stringify(ops))
		editor.select(new Selection())
		editor.apply(ops);
		regions = regions.map(function(r) {
			return editor.move(new Region(r.focus+1), 'characters', 1, false);
		});
		editor.select(new Selection(regions));
	}
	_delete.description = function(args) {
		return "Delete within table";
	};

	function _make_table(rows, columns, attributes) {
		var cell = '(cell "")'
		var _row = [];
		var i;
		for (i=0;i<columns;i++)
			_row.push(cell);
		var row = '(row ' + _row.join(' ') + ')';
		var _rows = [];
		for (i=0;i<rows;i++)
			_rows.push(row);
		var tbl = '(table ' + _rows.join(' ') + ')';
		if (attributes)
			tbl = JSON.stringify(attributes) + tbl;
		return ot.parse(tbl)[0];
	}

	function _insert_table(doc, region, args) {
		//insert table
		var rows = args.rows || 2;
		var cols = args.columns || args.cols || 2;
		var attributes = args.attributes || {headerRows:1};

		var as = doc.attributesAt(region.begin());
		var breaks = [];
		var ops = [];
		var a;
		for (var i = as.length - 1; i >= 0; i--) {
			var x = as[i];
			breaks.push(x);
			ops.push(ot.operations.pop);
			if (x.type === 'list') break;
		};
		//insert table here
		var tbl = _make_table(rows, cols, attributes);
		var x = tbl.prefix(0,tbl.size);
		ops = ops.concat(x);
		//fixup
		while ((a = breaks.pop())) {
			if (a.type === 'list') {
				ops.push(ot.operations.pushA(a.attributes));
				ops.push(ot.operations.insert('p','sym')); //a.node.head().sym
			} else {
				ops.push(ot.operations.pushS());
			}
		}
		return doc.replace(region, ops);
	}
	function insert_table(args) {
		var doc = editor.document();
		var ops = [];
		var regions = [];
		editor.selection().regions.forEach(function(region) {
			var op = _insert_table(doc, region, args);
			var no = ot.transform(op,ops);
			var x = firstString(no);
			if (x)
				regions.push(new Region(x));
			ops = ot.compose(ops, no);
		});
		editor.apply(ops);
		editor.select(new Selection(regions));
	}
	insert_table.description = function(args) {
		return "Insert table";
	};

	function _first_table(list) {
		if (typeof list !== 'object' || typeof list.head !== 'function')
			return;
		if (list.head().sym === 'table') return list;
		for (var i = 1; i < list.values.length; i++) {
			var v = list.values[i];
			var n = _first_table(v);
			if (n) return n;
		};
		return;
	}

	var NEW_ROW = ot.parse('(row)')[0];
	var NEW_CELL = ot.parse('(cell "")')[0];

	function _paste_table(tbl) {
		console.log("paste table into table")
		var ts = tableSelection();
		var doc = editor.document();
		var ops = [];
		var regions = [];

		var tbl_ext = extent(tbl);

		var table_extend = {};
		var table_points = [];

		var paste_content = {};

		//1. Work out how much to extend all the tables by
		ts.forEach(function(t) {
			var ext = extent(t.node)
			var e;
			if (table_extend[t.point]) {
				e = table_extend[t.point]
			}
			else {
				paste_content[t.point] = {};
				table_points.push(t.point);
				e = table_extend[t.point] = {t:t, 
					rows:ext.rows, columns:ext.columns};
			}
			//TODO
			//1.calculate full extent of the tables
			var mcol = tbl_ext.columns + t.start_col;
			var mrow = tbl_ext.rows + t.start_row;
			e.rows = Math.max(e.rows, mrow);
			e.columns = Math.max(e.columns, mcol);
			//2.set a hash for the cell content (overwrite if needed)
			// -- Excel the last selection wins if there is an overlap
			var pc = paste_content[t.point];
			for (var i=1;i<tbl.values.length;i++) {
				var row = tbl.values[i];
				var rn = t.start_row + i;
				for (var j = 1; j < row.values.length; j++) {
					var cell = row.values[j];
					var cn = t.start_col + j;
					pc[rn + ',' + cn] = cell; 
				};
			};
		});

		//3. Extend and or paste ...
		table_points.sort(); //just incase they are not in order
		//Loop over all the tables we are pasting into...
		table_points.forEach(function(tp) {
			var e = table_extend[tp];
			var t = e.t;
			var op = [];
			var pc = paste_content[tp];
			var table = t.node;
			//retain to start of table rows
			op.push(ot.operations.retain(t.point + 2));
			var rn = 1;
			//retain existing rows or paste
			for (; rn < table.values.length; rn++) {
				var row = table.values[rn];
				//retain to cells
				op.push(ot.operations.retain(2));
				var cn = 1;
				//retain existing cells or paste
				for (;cn < row.values.length; cn++) {
					var cell = row.values[cn];
					var key = rn + ',' + cn;
					if (pc.hasOwnProperty(key)) {
						//TODO: make this do a diff
						//delete existing cell
						op = op.concat(cell.prefix(0,cell.size, ot.operations.delete));
						//paste new cell
						var new_cell = pc[key];
						op = op.concat(new_cell.prefix(0,new_cell.size));
						var old_colSpan = cell.attributes ? (cell.attributes.colSpan || 1) : 1;
						var new_colSpan = new_cell.attributes ? (new_cell.attributes.colSpan || 1) : 1;

						var old_rowSpan = cell.attributes ? (cell.attributes.rowSpan || 1) : 1;
						var new_rowSpan = new_cell.attributes ? (new_cell.attributes.rowSpan || 1) : 1;
						if (old_rowSpan !== new_rowSpan || old_colSpan !== new_colSpan)
							throw "Cannot paste into area with non matching cell groupings";
					} else {
						op.push(ot.operations.retain(cell.size));
					}

				};
				//TODO... insert new cells or paste
				for (; cn <= e.columns; cn++) {
					var key = rn + ',' + cn;
					var cell = pc.hasOwnProperty(key) ? pc[key] : NEW_CELL;
					op = op.concat(cell.prefix(0,cell.size));
				}
				//retain end of row
				op.push(ot.operations.retain(1));
			};
			//insert new rows or paste
			for (; rn <= e.rows; rn++) {
				op = op.concat(NEW_ROW.prefix(0,2));
				var cn = 1;
				for (; cn <= e.columns; cn++) {
					var key = rn + ',' + cn;
					var cell = pc.hasOwnProperty(key) ? pc[key] : NEW_CELL;
					op = op.concat(cell.prefix(0,cell.size));
				}
				op = op.concat(NEW_ROW.prefix(2,NEW_ROW.size));
			}
			var no = ot.transform(op,ops);
			ops = ot.compose(ops, no);
		});

		console.log(JSON.stringify(ops))
		//editor.select(new Selection())
		editor.apply(ops);
		//regions = regions.map(function(r) {
		//	return editor.move(new Region(r.focus+1), 'characters', 1, false);
		//});
		//editor.select(new Selection(regions));
	}

	function _paste_text(txt) {
		console.log("paste text into table")
		var ts = tableSelection();
		var doc = editor.document();
		var ops = [];

		var txt_ops = txt.prefix(1,txt.size - 1)

		ts.forEach(function(t) {
			var ext = extent(t.node);
			var op = [];

			if (t.text_only) {
				//replace the selected text
				op = doc.replace(t.region, txt_ops);
			} else {
				//replace content of all the cells
				var table = t.node;
				//retain to start of rows
				op.push(ot.operations.retain(t.point + 2));
				for (var i = 1; i < table.values.length && (i-1) <= t.end_row; i++) {
					var row = table.values[i];
					var rn = i - 1;
					if (rn < t.start_row || rn > t.end_row) {
						ot._push(op, ot.operations.retain(row.size));
						console.log(row.size)
						continue;
					}
					//retain to cells
					ot._push(op, ot.operations.retain(2));
					for (var j = 1; j<row.values.length; j++) {
						var cell = row.values[j];
						var cn = j-1;
						if (cn < t.start_col || cn > t.end_col) {
							ot._push(op, ot.operations.retain(cell.size));
							continue;
						}
						//retain start of cell
						ot._push(op, ot.operations.retain(2));
						op = op.concat(cell.prefix(2,cell.size-1, ot.operations.delete));
						op = op.concat(txt.prefix(0,txt.size));
						//retain end of cell
						ot._push(op, ot.operations.retain(1));
					}
					//retain end of row
					ot._push(op, ot.operations.retain(1));
				}
			}
			var no = ot.transform(op,ops);
			ops = ot.compose(ops, no);
		});
		console.log(JSON.stringify(ops));
		editor.apply(ops);
	}

	function _text_content(content) {
		//TODO Return a better content string.
		return new AttributedString(content.textContent());
	}

	function paste(content) {
		//Check for a table in the paste.
		var tbl = _first_table(content);
		if (tbl) {
			//paste table into table
			_paste_table(tbl);
		} else {
			//paste text into all selected cells
			_paste_text(_text_content(content));
		}
	}
	paste.description = function(content) {
		return "Paste into table";
	};

	var NEW_P = (function() {
		var npl = new List();
		npl.push(sym('p'));
		npl.push(new AttributedString(""));
		return npl.prefix(0,npl.size);
	})();

	function table_last_row_to_paragraph() {
		var ts = tableSelection();
		var doc = editor.document();
		var ops = [];
		var regions = [];

		var small = ts.some(function(t) {
			var ext = extent(t.node);
			return ext.rows <= 2;
		});

		if (small) return insert_row({before:false});

		ts.forEach(function(t) {
			var ext = extent(t.node);
			var op = []

			op.push(ot.operations.retain(t.point));
			op = op.concat(_deleteRows(t.node, ext.rows-1, ext.rows-1));
			op.push(ot.operations.retain(1));
			op = op.concat(NEW_P);
			var no = ot.transform(op,ops);
			regions.push(new Region(firstString(no)));
			ops = ot.compose(ops, no);
		});
		//console.log(JSON.stringify(ops))
		editor.select(new Selection())
		editor.apply(ops);
		regions = regions.map(function(r) {
			return editor.move(new Region(r.focus+1), 'characters', 1, false);
		});
		editor.select(new Selection(regions));
	}
	table_last_row_to_paragraph.description = function() {
		return "Replace last row of table with paragraph";
	};

	return {
		table_move: move,
		table_move_to: moveTo,
		table_move_cell: move_cell,
		insert_table: insert_table,
		insert_row: insert_row,
		insert_column: insert_column,
		table_delete: _delete,
		table_paste: paste,
		table_last_row_to_paragraph: table_last_row_to_paragraph,
	};
}

var in_table_context = [{key:"head", operator:"equals", operand:"cell", match_all:true}];

var keymap = [
	{keys:["ctrl+k","b"], command:"table_move_to", args:{position:"bot"}},
	{keys:["ctrl+k","e"], command:"table_move_to", args:{position:"eot"}},
	{keys:["ctrl+k","a","b","up","down"], command:"table_move", args:{mode:"yay", forward:true}},
	{keys:["tab"], command:"table_move_cell", args:{forward:true}}, //, context:in_table_context},
	{keys:["shift+tab"], command:"table_move_cell", args:{forward:false}}, //, context:in_table_context},
	//{keys:["up"], command:"table_move", args:{mode:"row", forward:false}, context:in_table_context},
	//{keys:["down"], command:"table_move", args:{mode:"row", forward:true}, context:in_table_context},
	{keys:["alt+home"], command:"table_move_to", args:{mode:"bol"}, context:in_table_context},
	{keys:["ctrl+alt+c"], command:"insert_column", args:{before:true}, context:in_table_context},
	{keys:["ctrl+alt+r"], command:"insert_row", args:{before:false}, context:in_table_context},
	{keys:["ctrl+alt+d"], command:"insert_column", args:{before:false}, context:in_table_context},
	{keys:["ctrl+alt+s"], command:"insert_row", args:{before:true}, context:in_table_context},
	{keys:["enter"], command:"insert_row", args:{before:false}, context:in_table_context},
	{keys:["enter"], command:"table_last_row_to_paragraph", context:[
		{key:"head", operator:"equals", operand:"cell", match_all:true},
		{key:"row_preceding_text", operator:"regex_match", operand:"[\u0002\u0091\u0003\u0098\u009C]*", match_all:true},
		{key:"table_following_text", operator:"regex_match", operand:"[\u0002\u0091\u0003\u0098\u009C]*", match_all:true},
	]},
	{keys:["ctrl+alt+t"], command:"insert_table", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	//dummy huge table.
	{keys:["ctrl+alt+y"], command:"insert_table", args:{rows:1000,cols:5},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["backspace"], command:"table_delete",
		context:[
			{key:"head", operator:"in", operand:["cell","row","table"], match_all:true},
			{key:"selection_empty", operator:"equals", operand:false, match_all:true},
		]},
	{keys:["backspace"], command:"nop",
		context:[
			{key:"head", operator:"in", operand:["cell","row","table"], match_all:false},
			{key:"preceding_text", operator:"equals", operand:"", match_all:false},
		]},
	//paste when in table
	{keys:["paste"], command:"table_paste",
		context:[
			{key:"head", operator:"in", operand:["cell","row","table"], match_all:true},
		]},
];

var context_menu = [
	//insert table
	//insert col
	//insert row
	//etc.
];

module.exports = function(editor) {
	return {
		commands: commands(editor),
		keymap: keymap,
		//TODO: add plugin context
		menu: [],
		context_menu: context_menu,
	};	
};