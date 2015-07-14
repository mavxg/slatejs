slate
=====

Document editor based on operational transforms of attributed strings


gulp -- opens in browser

npm test -- run tests

## TODO

* [X] S-Expression document renderer
* [X] Inline selection renderer
* [X] FIX: Selection off by one error
* [X] FIX: Selection fails outside lines
* [X] FIX: Selection unstable under selection spans
* [X] FIX: Selection fails in code
* [X] Multiple selection
* [ ] Minimal selection update check
* [X] Keyboard shortcut system *** 
* [E] Table editor actions
	- Merge/Unmerge cells (optional)
	- Selection in single table context check
	- Shift+Space = select row
	- Ctrl+Space = select column
	- Ctrl+Shift+% = apply percentage format
	- Ctrl+Shift+# = apply date format
* [ ] Hookup Qube
	- Parse code and tables.
	- Insert results.
	- Insert global errors/messages
	- Cache result ops.
* [ ] Render out of date code (i.e. not yet calculated)
* [ ] Copy/Cut (inc table)
	- What does excel do about non rectangular selections
		and cut and paste? Does it merge them? Can only copy selections
		in a table if they line up (same start row and end row or same
		start column and end column). Just get an error if you try to
		copy something that doesn't line up.
	- Ctrl+y = redo last action (can also be used to repeat if the redo buffer is empty)
* [ ] Paste (inc table)
* [X] Scroll to cursor
* [X] Movement commands
* [X] Delete commands
* [ ] Attribute on paragraphs (??? how should it deal with tables
	  - attribute if in vs attribute only if fully selected.)
	  - Tables are shown fully selected so just attribute all the heads
	  - could have an allowable attributes on the symbol
	  	to avoid attributing things like a result with something that it
	  	cannot have.

* [ ] discard nop in livedb caused by _apply exception returning same doc.

* [X] eraseText(region) on doc //just a replaceText with ""
* [ ] Replace should balance missing closes by inserting after your insert.
      and missing opens by inserting before your insert. (or just collapse the
      selection like Google Docs)

# IDEA

QUBE integration. Have an output table format that is a table where the expressions
you type get evaluated and you get an output. If it varies over multiple dimensions then they become pivot slices. This is then an output table that is formatted like an input table. Entered like a table but evaluates like a pivot table output.

You should even be able to put something down the side to varie it over ...

(probably need columns --- before the rows in a table)

* IDEA: lens/scratch sidebar. Show calculations pulled out to the side and how they change
  when you change the model.


## Bugs

* Delete table elements not undoable

* Delete key at start of row causes row join

* Kerning changes when cursor is between kerned pairs. (Google docs solves this by not kerning text.)

* List items should nest inside other items not at the list level..

* Selection transform bug when overtyping with mulitple selections.

* line up doesn't work from after a freshly created section break.
   or TO or FROM a new line *** IMPORTANT

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Double character insert under some conditions (seems to be caused by critical regions)

* Fast >(space) doesn't trigger key combination.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



