export default {"history":[{"time":0,"state":{"pages":[{"id":0,"name":"Introduction","state":{"mode":"run","expr":"SheetOf(Note)","inner":[{"id":0,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"# Tables","note":{"type":"text","tag":"h1","text":"Tables"}}},{"id":41,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"A notes-spreadsheet-hybrid for programmers.","note":{"type":"text","tag":"p","text":"A notes-spreadsheet-hybrid for programmers."}}},{"id":7,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":2,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"As such, it is heavily keyboard-focused. Try ⌘⇧P to see all commands for the current focus (or ⌘?).","note":{"type":"text","tag":"p","text":"As such, it is heavily keyboard-focused. Try ⌘⇧P to see all commands for the current focus (or ⌘?)."}}},{"id":4,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"<span className=\"text-sm text-gray-500\">Note: Cmd/Meta/Ctrl can be used interchangeably in shortcuts</span>","note":{"type":"text","tag":"p","text":"<span className=\"text-sm text-gray-500\">Note: Cmd/Meta/Ctrl can be used interchangeably in shortcuts</span>"}}},{"id":44,"name":"","visibility":"block","state":{"v":0,"level":1,"input":"<span className=\"text-sm text-gray-500\">(this can be especially useful to circumvent the browser capturing a shortcut)</span>","note":{"type":"text","tag":"p","text":"<span className=\"text-sm text-gray-500\">(this can be especially useful to circumvent the browser capturing a shortcut)</span>"}}},{"id":6,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Navigation can also be done via keyboard. Focus things with `Enter` and get out with `Escape`. Move with `hjkl` or the `ArrowKey`s.","note":{"type":"text","tag":"p","text":"Navigation can also be done via keyboard. Focus things with `Enter` and get out with `Escape`. Move with `hjkl` or the `ArrowKey`s."}}},{"id":8,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":9,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Your document is automatically backed up to IndexedDB, but gets deleted after 7 days. So don't forget to save it to a local file.","note":{"type":"text","tag":"p","text":"Your document is automatically backed up to IndexedDB, but gets deleted after 7 days. So don't forget to save it to a local file."}}},{"id":24,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":25,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Tables gives you the full power of JavaScript and React.","note":{"type":"text","tag":"p","text":"Tables gives you the full power of JavaScript and React."}}},{"id":26,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"**Be aware:** You have the **power to break it** (but generally you can undo it – ⌘Z) and full responsibilty to **ensure you trust the code you run**.","note":{"type":"text","tag":"p","text":"**Be aware:** You have the **power to break it** (but generally you can undo it – ⌘Z) and full responsibilty to **ensure you trust the code you run**."}}},{"id":28,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Also beware of side-effects in your code: Everything is automatically rerun as needed (for changes), so side-effects may execute for every character you type.","note":{"type":"text","tag":"p","text":"Also beware of side-effects in your code: Everything is automatically rerun as needed (for changes), so side-effects may execute for every character you type."}}},{"id":43,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":10,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"## Usage","note":{"type":"text","tag":"h2","text":"Usage"}}},{"id":45,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Text","note":{"type":"text","tag":"h3","text":"Text"}}},{"id":46,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Just use Markdown","note":{"type":"text","tag":"p","text":"Just use Markdown"}}},{"id":47,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"*italic* **bold** [link](https://github.com/keenbug/tables)","note":{"type":"text","tag":"p","text":"*italic* **bold** [link](https://github.com/keenbug/tables)"}}},{"id":48,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"- List","note":{"type":"text","tag":"li","text":"List"}}},{"id":49,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"[ ] Todo","note":{"type":"checkbox","checked":false,"text":"Todo"}}},{"id":50,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"[x] Done","note":{"type":"checkbox","checked":true,"text":"Done"}}},{"id":51,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Inline <span className=\"text-blue-800\">\"Html/React/tailwindcss\"</span> supported <span className=\"text-xs text-gray-700\">(kind of)</span>","note":{"type":"text","tag":"p","text":"Inline <span className=\"text-blue-800\">\"Html/React/tailwindcss\"</span> supported <span className=\"text-xs text-gray-700\">(kind of)</span>"}}},{"id":15,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Computations","note":{"type":"text","tag":"h3","text":"Computations"}}},{"id":11,"name":"msInADay","visibility":"block","state":{"v":0,"level":0,"input":"= 24 /*h*/ * 60 /*min*/ * 60 /*sec*/ * 1000 /*ms*/","note":{"type":"expr","code":" 24 /*h*/ * 60 /*min*/ * 60 /*sec*/ * 1000 /*ms*/"}}},{"id":12,"name":"startOfThisYear","visibility":"block","state":{"v":0,"level":0,"input":"= new Date(new Date().getFullYear(), 0, 1)","note":{"type":"expr","code":" new Date(new Date().getFullYear(), 0, 1)"}}},{"id":13,"name":"daysInThisYear","visibility":"block","state":{"v":0,"level":0,"input":"= (Date.now() - startOfThisYear.getTime()) / msInADay","note":{"type":"expr","code":" (Date.now() - startOfThisYear.getTime()) / msInADay"}}},{"id":14,"name":"","visibility":"result","state":{"v":0,"level":0,"input":"= // using react:\n<p className=\"py-2\">\n  This year is already {/* preserve the space character before this comment */}\n  {daysInThisYear.toLocaleString(\"en-US\", { maximumFractionDigits: 1 })}\n  {} days long. {}\n  <span className=\"text-sm text-gray-700\">(Select this line and show or hide the code with ⌘M)</span>\n</p>","note":{"type":"expr","code":" // using react:\n<p className=\"py-2\">\n  This year is already {/* preserve the space character before this comment */}\n  {daysInThisYear.toLocaleString(\"en-US\", { maximumFractionDigits: 1 })}\n  {} days long. {}\n  <span className=\"text-sm text-gray-700\">(Select this line and show or hide the code with ⌘M)</span>\n</p>"}}},{"id":27,"name":"","visibility":"result","state":{"v":0,"level":0,"input":"= <p>The last time this block was computed: {new Date().toLocaleString()}</p>","note":{"type":"expr","code":" <p>The last time this block was computed: {new Date().toLocaleString()}</p>"}}},{"id":17,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Using different Blocks","note":{"type":"text","tag":"h3","text":"Using different Blocks"}}},{"id":19,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Available builtin blocks:","note":{"type":"text","tag":"p","text":"Available builtin blocks:"}}},{"id":18,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"= <tables.ui.value.ValueInspector value={blocks} expandLevel={1} />","note":{"type":"expr","code":" <tables.ui.value.ValueInspector value={blocks} expandLevel={1} />"}}},{"id":31,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":21,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Use one like this:","note":{"type":"text","tag":"p","text":"Use one like this:"}}},{"id":20,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.JSExpr // ⌘-Enter or click on \"Preview\" below to instantiate","note":{"type":"block","isInstantiated":false,"code":"blocks.JSExpr // ⌘-Enter or click on \"Preview\" below to instantiate"}}},{"id":30,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":22,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Instantiated example:","note":{"type":"text","tag":"p","text":"Instantiated example:"}}},{"id":23,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.JSExpr","note":{"type":"block","isInstantiated":true,"code":"blocks.JSExpr","state":"// This is a JSExpr Block with some Code\nfunction defaultView(data) {\n  return <tables.ui.value.ValueInspector value={data} expandLevel={0} />\n}\n\nfunction Table({ data, view=defaultView }) {\n  return (\n    <table>\n      <tbody>\n        {data.map((row, y) => (\n          <tr key={y}>\n            {row.map((cell, x) => (\n              <td key={x} className=\"hover:bg-gray-100\">{view(cell)}</td>\n            ))}\n          </tr>\n        ))}\n      </tbody>\n    </table>\n  )\n}\n\n// The last expression is \"returned\"\n<Table\n  data={[\n    [1,2,3],\n    [\"4\",\"5\",\"6\"],\n    [{seven: {}}, {eight: {}}, {nine: { surprise: 10 }}],\n  ]}\n  />"}}},{"id":29,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":34,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Some Blocks take arguments:","note":{"type":"text","tag":"p","text":"Some Blocks take arguments:"}}},{"id":35,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.Input(Number.parseInt)","note":{"type":"block","isInstantiated":false,"code":"blocks.Input(Number.parseInt)"}}},{"id":42,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Results in:","note":{"type":"text","tag":"p","text":"Results in:"}}},{"id":36,"name":"inputInt","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.Input(Number.parseInt)","note":{"type":"block","isInstantiated":true,"code":"blocks.Input(Number.parseInt)","state":"123.1313"}}},{"id":37,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"= inputInt","note":{"type":"expr","code":" inputInt"}}},{"id":38,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":32,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Some Blocks are higher-order – they take another Block as an argument:","note":{"type":"text","tag":"p","text":"Some Blocks are higher-order – they take another Block as an argument:"}}},{"id":33,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.SheetOf(blocks.JSExpr)","note":{"type":"block","isInstantiated":false,"code":"blocks.SheetOf(blocks.JSExpr)"}}},{"id":40,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Looks like this:","note":{"type":"text","tag":"p","text":"Looks like this:"}}},{"id":39,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.SheetOf(blocks.JSExpr)","note":{"type":"block","isInstantiated":true,"code":"blocks.SheetOf(blocks.JSExpr)","state":[{"id":0,"name":"","visibility":"block","state":"// This is a sheet's line with a JSExpr block\n12"},{"id":1,"name":"number","visibility":"block","state":"$0 * $0"},{"id":2,"name":"input","visibility":"block","state":"// You can still use stuff from above\n/* outer sheet: */ inputInt + /* above */ number"},{"id":3,"name":"","visibility":"block","state":"// The nesting of a Sheet inside a Sheet has the effect that\n// the CSS doesn't work 100% as intended and the blue/gray line\n// indicators on the left behave funny"}]}}}]},"isCollapsed":true,"children":[]}],"viewState":{"sidebarOpen":true,"openPage":[0]},"template":{"id":1,"name":"","state":{"mode":"run","expr":"SheetOf(Note)","inner":[{"id":0,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}}]},"isCollapsed":true,"children":[]}}}],"inner":{"pages":[{"id":0,"name":"Introduction","state":{"mode":"run","expr":"SheetOf(Note)","inner":[{"id":0,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"# Tables","note":{"type":"text","tag":"h1","text":"Tables"}}},{"id":41,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"A notes-spreadsheet-hybrid for programmers.","note":{"type":"text","tag":"p","text":"A notes-spreadsheet-hybrid for programmers."}}},{"id":7,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":2,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"As such, it is heavily keyboard-focused. Try ⌘⇧P to see all commands for the current focus (or ⌘?).","note":{"type":"text","tag":"p","text":"As such, it is heavily keyboard-focused. Try ⌘⇧P to see all commands for the current focus (or ⌘?)."}}},{"id":4,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"<span className=\"text-sm text-gray-500\">Note: Cmd/Meta/Ctrl can be used interchangeably in shortcuts</span>","note":{"type":"text","tag":"p","text":"<span className=\"text-sm text-gray-500\">Note: Cmd/Meta/Ctrl can be used interchangeably in shortcuts</span>"}}},{"id":44,"name":"","visibility":"block","state":{"v":0,"level":1,"input":"<span className=\"text-sm text-gray-500\">(this can be especially useful to circumvent the browser capturing a shortcut)</span>","note":{"type":"text","tag":"p","text":"<span className=\"text-sm text-gray-500\">(this can be especially useful to circumvent the browser capturing a shortcut)</span>"}}},{"id":6,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Navigation can also be done via keyboard. Focus things with `Enter` and get out with `Escape`. Move with `hjkl` or the `ArrowKey`s.","note":{"type":"text","tag":"p","text":"Navigation can also be done via keyboard. Focus things with `Enter` and get out with `Escape`. Move with `hjkl` or the `ArrowKey`s."}}},{"id":8,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":9,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Your document is automatically backed up to IndexedDB, but gets deleted after 7 days. So don't forget to save it to a local file.","note":{"type":"text","tag":"p","text":"Your document is automatically backed up to IndexedDB, but gets deleted after 7 days. So don't forget to save it to a local file."}}},{"id":24,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":25,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Tables gives you the full power of JavaScript and React.","note":{"type":"text","tag":"p","text":"Tables gives you the full power of JavaScript and React."}}},{"id":26,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"**Be aware:** You have the **power to break it** (but generally you can undo it – ⌘Z) and full responsibilty to **ensure you trust the code you run**.","note":{"type":"text","tag":"p","text":"**Be aware:** You have the **power to break it** (but generally you can undo it – ⌘Z) and full responsibilty to **ensure you trust the code you run**."}}},{"id":28,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Also beware of side-effects in your code: Everything is automatically rerun as needed (for changes), so side-effects may execute for every character you type.","note":{"type":"text","tag":"p","text":"Also beware of side-effects in your code: Everything is automatically rerun as needed (for changes), so side-effects may execute for every character you type."}}},{"id":43,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":10,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"## Usage","note":{"type":"text","tag":"h2","text":"Usage"}}},{"id":45,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Text","note":{"type":"text","tag":"h3","text":"Text"}}},{"id":46,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Just use Markdown","note":{"type":"text","tag":"p","text":"Just use Markdown"}}},{"id":47,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"*italic* **bold** [link](https://github.com/keenbug/tables)","note":{"type":"text","tag":"p","text":"*italic* **bold** [link](https://github.com/keenbug/tables)"}}},{"id":48,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"- List","note":{"type":"text","tag":"li","text":"List"}}},{"id":49,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"[ ] Todo","note":{"type":"checkbox","checked":false,"text":"Todo"}}},{"id":50,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"[x] Done","note":{"type":"checkbox","checked":true,"text":"Done"}}},{"id":51,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Inline <span className=\"text-blue-800\">\"Html/React/tailwindcss\"</span> supported <span className=\"text-xs text-gray-700\">(kind of)</span>","note":{"type":"text","tag":"p","text":"Inline <span className=\"text-blue-800\">\"Html/React/tailwindcss\"</span> supported <span className=\"text-xs text-gray-700\">(kind of)</span>"}}},{"id":15,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Computations","note":{"type":"text","tag":"h3","text":"Computations"}}},{"id":11,"name":"msInADay","visibility":"block","state":{"v":0,"level":0,"input":"= 24 /*h*/ * 60 /*min*/ * 60 /*sec*/ * 1000 /*ms*/","note":{"type":"expr","code":" 24 /*h*/ * 60 /*min*/ * 60 /*sec*/ * 1000 /*ms*/"}}},{"id":12,"name":"startOfThisYear","visibility":"block","state":{"v":0,"level":0,"input":"= new Date(new Date().getFullYear(), 0, 1)","note":{"type":"expr","code":" new Date(new Date().getFullYear(), 0, 1)"}}},{"id":13,"name":"daysInThisYear","visibility":"block","state":{"v":0,"level":0,"input":"= (Date.now() - startOfThisYear.getTime()) / msInADay","note":{"type":"expr","code":" (Date.now() - startOfThisYear.getTime()) / msInADay"}}},{"id":14,"name":"","visibility":"result","state":{"v":0,"level":0,"input":"= // using react:\n<p className=\"py-2\">\n  This year is already {/* preserve the space character before this comment */}\n  {daysInThisYear.toLocaleString(\"en-US\", { maximumFractionDigits: 1 })}\n  {} days long. {}\n  <span className=\"text-sm text-gray-700\">(Select this line and show or hide the code with ⌘M)</span>\n</p>","note":{"type":"expr","code":" // using react:\n<p className=\"py-2\">\n  This year is already {/* preserve the space character before this comment */}\n  {daysInThisYear.toLocaleString(\"en-US\", { maximumFractionDigits: 1 })}\n  {} days long. {}\n  <span className=\"text-sm text-gray-700\">(Select this line and show or hide the code with ⌘M)</span>\n</p>"}}},{"id":27,"name":"","visibility":"result","state":{"v":0,"level":0,"input":"= <p>The last time this block was computed: {new Date().toLocaleString()}</p>","note":{"type":"expr","code":" <p>The last time this block was computed: {new Date().toLocaleString()}</p>"}}},{"id":17,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"### Using different Blocks","note":{"type":"text","tag":"h3","text":"Using different Blocks"}}},{"id":19,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Available builtin blocks:","note":{"type":"text","tag":"p","text":"Available builtin blocks:"}}},{"id":18,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"= <tables.ui.value.ValueInspector value={blocks} expandLevel={1} />","note":{"type":"expr","code":" <tables.ui.value.ValueInspector value={blocks} expandLevel={1} />"}}},{"id":31,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":21,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Use one like this:","note":{"type":"text","tag":"p","text":"Use one like this:"}}},{"id":20,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.JSExpr // ⌘-Enter or click on \"Preview\" below to instantiate","note":{"type":"block","isInstantiated":false,"code":"blocks.JSExpr // ⌘-Enter or click on \"Preview\" below to instantiate"}}},{"id":30,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":22,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Instantiated example:","note":{"type":"text","tag":"p","text":"Instantiated example:"}}},{"id":23,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.JSExpr","note":{"type":"block","isInstantiated":true,"code":"blocks.JSExpr","state":"// This is a JSExpr Block with some Code\nfunction defaultView(data) {\n  return <tables.ui.value.ValueInspector value={data} expandLevel={0} />\n}\n\nfunction Table({ data, view=defaultView }) {\n  return (\n    <table>\n      <tbody>\n        {data.map((row, y) => (\n          <tr key={y}>\n            {row.map((cell, x) => (\n              <td key={x} className=\"hover:bg-gray-100\">{view(cell)}</td>\n            ))}\n          </tr>\n        ))}\n      </tbody>\n    </table>\n  )\n}\n\n// The last expression is \"returned\"\n<Table\n  data={[\n    [1,2,3],\n    [\"4\",\"5\",\"6\"],\n    [{seven: {}}, {eight: {}}, {nine: { surprise: 10 }}],\n  ]}\n  />"}}},{"id":29,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":34,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Some Blocks take arguments:","note":{"type":"text","tag":"p","text":"Some Blocks take arguments:"}}},{"id":35,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.Input(Number.parseInt)","note":{"type":"block","isInstantiated":false,"code":"blocks.Input(Number.parseInt)"}}},{"id":42,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Results in:","note":{"type":"text","tag":"p","text":"Results in:"}}},{"id":36,"name":"inputInt","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.Input(Number.parseInt)","note":{"type":"block","isInstantiated":true,"code":"blocks.Input(Number.parseInt)","state":"123.1313"}}},{"id":37,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"= inputInt","note":{"type":"expr","code":" inputInt"}}},{"id":38,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}},{"id":32,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Some Blocks are higher-order – they take another Block as an argument:","note":{"type":"text","tag":"p","text":"Some Blocks are higher-order – they take another Block as an argument:"}}},{"id":33,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/blocks.SheetOf(blocks.JSExpr)","note":{"type":"block","isInstantiated":false,"code":"blocks.SheetOf(blocks.JSExpr)"}}},{"id":40,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"Looks like this:","note":{"type":"text","tag":"p","text":"Looks like this:"}}},{"id":39,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"/block blocks.SheetOf(blocks.JSExpr)","note":{"type":"block","isInstantiated":true,"code":"blocks.SheetOf(blocks.JSExpr)","state":[{"id":0,"name":"","visibility":"block","state":"// This is a sheet's line with a JSExpr block\n12"},{"id":1,"name":"number","visibility":"block","state":"$0 * $0"},{"id":2,"name":"input","visibility":"block","state":"// You can still use stuff from above\n/* outer sheet: */ inputInt + /* above */ number"},{"id":3,"name":"","visibility":"block","state":"// The nesting of a Sheet inside a Sheet has the effect that\n// the CSS doesn't work 100% as intended and the blue/gray line\n// indicators on the left behave funny"}]}}}]},"isCollapsed":true,"children":[]}],"viewState":{"sidebarOpen":true,"openPage":[0]},"template":{"id":1,"name":"","state":{"mode":"run","expr":"SheetOf(Note)","inner":[{"id":0,"name":"","visibility":"block","state":{"v":0,"level":0,"input":"","note":{"type":"text","tag":"p","text":""}}}]},"isCollapsed":true,"children":[]}}}
