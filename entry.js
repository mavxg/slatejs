import { renderComponent, createClass, DOM } from 'friar'
import { Editor, Document } from './editor'
import { parse, Selection, Region, apply, transformCursor } from 'ot-sexpr'

const base = require('./plugins/base');
const table = require('./plugins/table');

const doc = `(doc (section
(p "")
{"headerRows":1}(table
(row (cell "Cat[]=") (cell "Qube[]") (cell "Other[]") (cell "Extra"))
(row (cell "First") (cell "99") (cell "100") (cell))
(row (cell "Second") (cell "199") (cell "200") (cell))
(row (cell "Third") (cell "299") (cell "300") (cell))
)
(h1 "Welcome to SlateJS")
(p "Welcome to your editor.")
(p [[76,{}],[2,{"sub":true}],[24,{}],[2,{"sup":true}],[76,{}],[16,{"href":"http://google.co.uk"}],[177,{}]]"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, aliquid ex necessitatibus repellatTM a illo fuga dolore aperiam totam tempore nisi neque delectus labore, nihil quae dignissimos dolores mollitia? Vel sunt neque voluptatibus excepturi laboriosam possimus adipisci quidem dolores, omnis nemo dolore eligendi blanditiis, voluptatem in doloribus hic aperiam.")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
) (section
(h1 "Another Section")
(p "Another paragraph in a another section")
(code "Another = Qube * Other + 5")
(code "Extra[Cat=First] = 77")
(code "Extra = 88")
(code "Test[Cat=First] = 123456")
(code "Another[Cat=First]")
(code "Qube[Cat=First]")
(ulli "First list item")
{"indent":2}(ulli "First sub list item")
{"indent":3}(ulli "First sub sub list item")
(ulli "Second list item")
{"indent":2}(ulli "First sub list item")
{"indent":2}(ulli "Second sub list item")
(olli "First list item")
{"indent":2}(olli "First sub list item")
{"indent":2}(olli "Second sub list item")
(olli "Second list item")
(blockquote "This is a really important quote.")
(pullquote "This is another really important quote.")
{"alignments":["left","right"], "headerRows":1}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(result (p "paragraph in a result"))
(p "")
))`

const sel = new Selection([new Region(12,9)]);

//Example of how to make a document undo manager plugin
var undoer = (editor) => {
	function undo() {
		console.log('Would love to undo right now.');
	}
	undo.description = () => "Undo previous action.";

	function redo() {
		console.log('Would love to redo right now.')
	}
	redo.description = () => "Redo previous action.";

	return {
		commands: {
			undo,
			redo,
		},
		keymap: [
			{keys:["ctrl+z"], command:"undo"},
			{keys:["cmd+z"], command:"undo"},
			{keys:["ctrl+shift+z"], command:"redo"},
			{keys:["cmd+y"], command:"redo"},
		]
	}
}

var App = createClass({
	getInitialState: function() {
		var state = {
			document: parse(this.props.doc)[0],
			selection: sel
		};
		return state;
	},
	apply: function(ops, selection, compose) {
		var doc = apply(this.state.document, ops);
		var sel = selection ? selection :
			transformCursor(this.state.selection, ops, true)
		this.setState({
			document: doc, 
			selection: sel
		});
		//TODO: this.undoManager.add(ops, compose);
	},
	select: function(selection) {
		if (this.state.selection !== selection)
			this.setState({selection: selection});
	},
	render: function() {
		var s = this.state;
		return Editor({
			document: s.document,
			apply: this.apply,
			select: this.select,
			selection: s.selection,
			plugins:[undoer, base, table]
		});
	}
});

//Why do the plugins need to have access to the editor?
//They need to provide commands and a set of keymaps

renderComponent(App({doc}),document.getElementById('app'));