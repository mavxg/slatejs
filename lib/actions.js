//actions that can be performed on a store/editor.

module.exports = {
	goLineUp:        function(st, ed) {st.moveV(-1, 'line');},
	goLineDown:      function(st, ed) {st.moveV(1, 'line');},
	goCharLeft:      function(st, ed) {st.moveH(-1, 'char');},
	goCharRight:     function(st, ed) {st.moveH(1, 'char');},
	extendLineUp:    function(st, ed) {st.moveV(-1, 'line', true);},
	extendLineDown:  function(st, ed) {st.moveV(1, 'line', true);},
	extendCharLeft:  function(st, ed) {st.moveH(-1, 'char', true);},
	extendCharRight: function(st, ed) {st.moveH(1, 'char', true);},
	delCharBefore:   function(st, ed) {st.deleteH(-1, 'char');},
    delCharAfter:    function(st, ed) {st.deleteH(1, 'char');},
    newline:         function(st, ed) {st.newline();},
    undo:            function(st, ed) {st.undo();},
    redo:            function(st, ed) {st.redo();}
};