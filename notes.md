# Motivation

Something like Notion, but local (not cloud) and more flexible (customizable through/in code).


# Ideas

- There are cells, describing a "unit" of data (corresponding to cells in excel or lines/whatever in notion)
    - every cell can be switched between 3 different states:
        - view: display the user data (e.g. a paragraph of text)
        - edit: change user data (e.g. a paragraph of text in a small text editor)
        - code: change the underlying code
    - a cell consists of
        - data: the user (editable) data
        - code: determining the cells behaviour and view in the view and edit state
        - (interactive state: volatile state that is not persisted and can be lost because of user actions. Only used for the UI. Does not contain data the user explicitly wants to persist)
    - cells can be nested in cells


# Current

* Dynamic Tables
    - [x] Add dynamic columns (user code)
    * Save Table Data
    * Make Raw Data editable (JSON)
    * Make Raw Columns Editable
        * Maybe needs REPL for Dynamic Function Stuff?
* Styling
    - [x] How to style in React? (styled?)
        - yep
    - [ ] Style Table
    - [x] Style REPL
        * Done to a certain degree. Move on
* User REPL
    - [x] Make a big single-Code version
    - [x] Save Code
    - [x] Make it switchable in states: Code only, side-by-side, result only
    - [x] find out when a value is a React Component
        * Maybe subclass/instance of some React Class?
            * React.isValidElement(value)
    - [x] Make it multi-line:
        - [x] each line switchable
        - [x] can be saved in a variable
    - [x] Add local Definitions
    - [x] Make it a big single-Code version again
        - [x] Extend modes to be: live code, code, app, state
            - [x] add state to code
            - [x] change from modes to individual visibility toggles
            - [x] show app and code myself
* Work on Tables/Spreadsheets again


# Future

* REPL
    * console-feed?
    * Addable dependencies?
        * Transpile with Babel?
        * Bundle? Every Lib needs to be specially bundled?
            * Can npm/yarn be executed in the browser?

* Other Code Editor?
    - monaco? (~VSCode) https://github.com/Microsoft/monaco-editor
    - CodeMirror? https://github.com/codemirror/CodeMirror
    

# Used Technologies

Babel - https://old.babeljs.io/docs/usage/api/#options
Fontawesome - https://fontawesome.com/v5.15/icons?d=gallery
              https://fontawesome.com/v5.15/how-to-use/on-the-web/using-with/react
Tailwindcss - https://tailwindcss.com/docs/utility-first
              https://tailwindcomponents.com/cheatsheet/
CodeJar
PrismJS
ReactJS