# Tables

*working title*

[Try it](https://tbls.dev/)

A notes-spreadsheet-hybrid for programmers. Write notes, store data and process
it. Harness the power of JavaScript, React and their ecosystems with the ease of
use of a spreadsheet. Even extending Tables with your custom Blocks for your
use-case is possible.


## Background

This is still a prototype. The code is neither documented nor has it many tests.
This made it easier for me to experiment with different ideas and discard them.
Despite efforts to make it stable, it can crash because of errors in the code a
user writes in it. Also, I'm sure tables itself still has enough bugs. ;)

One of my goals was to keep the codebase as simple while still as versatile and
powerful as possible. I'm currently very pleased with the state in this regard.
In `src/index.tsx` you can see the hard-coded root "Block", which can be thought
of as a cell in Excel or a line/page/database in Notion.


## Development

Running Tables locally should be easy. Make sure you have a `node` environment and
`yarn` (classic/v1) installed. Then:

    $ yarn
      ... installs depenencies ...

    $ yarn start
      ... starts development server (parcel) ...

and Tables should be up and running on http://localhost:1234/.