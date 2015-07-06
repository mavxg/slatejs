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
* [ ] Keyboard shortcut system *** 
* [ ] Table editor actions
* [ ] Hookup Qube
* [ ] Render out of date code (i.e. not yet calculated)

* [ ] Replace should balance missing closes by inserting after your insert.
      and missing opens by inserting before your insert.

## Bugs

* thrown exception in apply causes the application to be left in a broken state (locked)

* multiple spaces need to render as multiple spaces.

* Alternating dissappearing cursor when typing with multiple selections.

* Selection transform bug when overtyping with mulitple selections.

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Random lockup on right click for all browsers. Will not focus the textarea again.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



