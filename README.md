# Tables

*working title*

[Try it](https://tbls.dev/)

A notes-spreadsheet-hybrid for programmers. Write notes, store data and process
it. Harness the power of JavaScript, React and their ecosystems with the ease of
use of a spreadsheet. Even extending Tables with your custom Blocks (the
equivalent of cells in a spreadsheet) for your use-case is possible.


## Discord

For Questions, Feedback, or showing what you did in Tables (I'm always
interested, please share!) join the Tables Discord Server:

[Join Tables on Discord](https://discord.gg/TQePmKJNQP)


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
      ... installs dependencies ...

    $ yarn start
      ... starts development server (parcel) ...

and Tables should be up and running on http://localhost:1234/.


## Architecture

```mermaid
graph TD;

  web["`**src/web/**
*the web app*`"];

  blocks["`**src/blocks/**
*library of blocks*`"];

  core["`**src/core/**
*core definition of a block*`"];

  code["`**src/code/**
*edit and run javascript*`"]

  docs["`**src/docs/**
*provide documentation*`"]

  web --> core & blocks;
  blocks --> core & code; 
  blocks & web --> docs;
```