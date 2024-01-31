# Tables

*working title*

[Live demo](https://keenbug.github.io/tables/)

The initial idea was to create some sort of Excel and Notion hybrid. Currently
it is more of a Jupyter Notebook for JavaScript and React.

One of my goals was to keep the codebase as simple while still as versatile and
powerful as possible. I'm currently very pleased with the state in this regard.
In `src/index.tsx` you can see the hard-coded root "Block", which can be thought
of as a cell in Excel or a line/page/database in notion.

This is still a prototype. The code is neither documented nor has it any tests.
This made it easier for me to experiment with different ideas and discard them.
Despite efforts to make it stable, it can crash because of errors in the code a
user writes in it. Also, I'm sure tables itself still has enough bugs. ;)


## "Tutorial"

When you open tables you see an empty document, realized by the Document Block
(the hard-coded root block). It offers a sidebar with saving, loading and
history functionality. You can find example documents to load in `examples/`.
There is a tree of pages in the sidebar, where you can work with another type of
Blocks. The main area shows the Block of a selected page.

That is the Selector Block, which gives you the possibility to choose a Block
yourself. `blocks/index.tsx` offers Blocks to choose from. The
input expects a JavaScript expression where the Blocks from `blocks/index.tsx`
are in scope. You can also define custom Blocks and then use them there.

After typing a valid Block, for example `JSExpr` or `SheetOf(JSExpr)`, there are
two areas below: a preview of the Block and the state of the block. Clicking on
the "Block" area activates the Block and hides the Command Block interface. You
can get back to choosing the Block by clicking on the small gray "JSExpr" or
"SheetOf(JSExpr)" label at the top.

I think this should be enough to start playing around.