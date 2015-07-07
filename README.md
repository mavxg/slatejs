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
* [ ] FIX: Selection unstable under selection spans
* [X] FIX: Selection fails in code
* [X] Multiple selection
* [ ] Minimal selection update check
* [X] Keyboard shortcut system *** 
* [ ] Table editor actions
* [ ] Hookup Qube
* [ ] Render out of date code (i.e. not yet calculated)

* [ ] Replace should balance missing closes by inserting after your insert.
      and missing opens by inserting before your insert.

* [ ] discard nop in livedb caused by _apply exception returning same doc.

## Bugs

* List items should nest inside other items not at the list level..

* -Alternating dissappearing cursor when typing with multiple selections.
  *** because the selection is getting reversed somewhere.- FIXED.

* Selection transform bug when overtyping with mulitple selections.

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Random lockup on right click for all browsers. Will not focus the textarea again.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



