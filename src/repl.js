import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import babelGenerator from '@babel/generator'

import { ValueViewer, ValueInspector, initialBlockState } from './value'
import { EditableCode } from './code-editor'
import { IconToggleButton, TextInput, classed, onMetaEnter } from './ui'
import { nextElem, runUpdate } from './utils'


/**************** User Code Execution **************/

export const runExpr = (code, env) => {
    if (!code) {
        return
    }
    try {
        const exprAst = babelParser.parseExpression(code, { plugins: [ "jsx" ] })
        const programAst = {
            type: 'Program',
            interpreter: null,
            sourceType: 'module',
            body: [
                {
                    type: "ReturnStatement",
                    argument: exprAst,
                },
            ],
            directives: [],
        }

        const { code: transformedCode } = babel.transformFromAstSync(
            programAst,
            code,
            {
                presets: [babelReact],
            },
        )

        const exprFunc = new Function(
            ...Object.keys(env),
            transformedCode,
        )
        return exprFunc(...Object.values(env))
    }
    catch (e) {
        return e
    }
}

export const stripCachedResult = code => (
    code ?
        {
            ...code,
            prev: stripCachedResult(code.prev),
            cachedResult: null,
        }
    :
        null
)

export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const combineComponents = (...components) =>
    components.reduce(
        (entity, component) => ({
            ...entity,
            ...component,
        }),
        {},
    )

export const UtilsComponent = {
    applyWhen(cond, fn) {
        if (cond) {
            return fn(this)
        }
        return this
    }
}

export const UpdateComponent = {
    update(newValues) {
        return {
            ...this,
            ...newValues
        }
    },
    mapFields(mappers) {
        const newValues =
            Object.fromEntries(
                Object.entries(mappers)
                    .map(
                        ([ name, fn ]) => [
                            name,
                            fn(this[name])
                        ]
                    )
            )
        return this.update(newValues)
    }
}

export const JSExprComponent = {
    expr: "",

    exec(env) {
        return runExpr(this.expr, env)
    },
}

export const CachedComputationComponent = {
    cachedResult: null,
    invalidated: true,
    autorun: true,

    updateExpr(expr) {
        return this
            .update({ expr })
            .invalidate()
    },
    precompute(env) {
        if (!this.invalidated) { return this }
        return this.update({
            cachedResult: this.exec(env)
        })
    },
    invalidate() {
        if (!this.autorun) { return this }
        return this.update({
            invalidated: true
        })
    },
    forcecompute(env) {
        return this.update({
            cachedResult: this.exec(env)
        })
    },
}

export const EnvironmentComponent = {
    id: 0,
    name: "",
    prev: null,

    getDefaultName() {
        return '$' + this.id
    },
    getName() {
        return this.name.length > 0 ? this.name : this.getDefaultName()
    },
    getNextFreeId(candidate = 0) {
        const freeCandidate = candidate === this.id ? candidate + 1 : candidate
        return this.prev ? this.prev.getNextFreeId(freeCandidate) : freeCandidate
    },

    reindex(codeNotToClashWith) {
        const prev = this.prev?.reindex(codeNotToClashWith)
        const id = codeNotToClashWith.getNextFreeId(prev ? prev.id + 1 : 0)
        return this.update({ id, prev })
    },
    append(prev) {
        if (this.prev) {
            return this.update({ prev: this.prev.append(prev) })
        }
        else {
            return this.update({ prev })
        }
    },

    getWithId(id) {
        if (this.id === id) {
            return this
        }
        else {
            return this.prev?.getWithId(id)
        }
    },
    mapWithId(id, fn) {
        if (this.id === id) {
            return fn(this)
        }
        else {
            return this.update({
                prev: this.prev?.mapWithId(id, fn)
            })
        }
    },
    toList() {
        if (!this.prev) { return [this] }
        return [ this, ...this.prev.toList() ]
    },
    fromList(list) {
        return list.reduceRight(
            (prev, code) => code.update({ prev }),
            null,
        )
    },
}

export const CachedEnvironmentComponent = {
    precomputeAll(globalEnv) {
        const prev = this.prev?.precomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .precompute({ ...globalEnv, ...env })
            .update({ prev })
    },
    forcecomputeAll(globalEnv) {
        const prev = this.prev?.forcecomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .forcecompute({ ...globalEnv, ...env })
            .update({ prev })
    },

    updateExprWithId(id, expr) {
        return this
            .mapWithId(id, code => code.update({ expr }))
            .invalidateWithId(id)
    },
    invalidateWithId(id) {
        if (this.id === id) {
            return this.invalidate()
        }
        else {
            return this
                .update({
                    prev: this.prev.invalidateWithId(id)
                })
                .invalidate()
        }
    },

    toEnv() {
        return Object.fromEntries(
            this.toList()
                .map(code => [ code.getName(), code.cachedResult ])
        )
    },

    loadFrom(data) {
        return this.update({
            ...data,
            prev: data.prev && this.loadFrom(data.prev),
        })
    },

    stripCachedResults() {
        const prev = this.prev?.stripCachedResults()
        return this.update({
            cachedResult: null,
            prev,
        })
    },
}

export const BlockComponent = {
    state: initialBlockState,
    usageMode: USAGE_MODES[0],
}


export const CodeComponent = combineComponents(
    UtilsComponent,
    UpdateComponent,
    JSExprComponent,
    CachedComputationComponent,
    EnvironmentComponent,
    CachedEnvironmentComponent,
    BlockComponent,
    {
        ui: combineComponents(UpdateComponent, defaultCodeUI),
    },
)

export const appendCode = (code, prevCode) =>
    code === null ? prevCode : { ...code, prev: appendCode(code.prev, prevCode) }

export const concatCode = codes => codes.reduceRight((prev, cur) => appendCode(cur, prev), null)

export const reindexCode = (code, nextId) => {
    if (!code) { return null }
    const prev = reindexCode(code.prev, nextId)
    const id = prev ? nextId(prev.id) : nextId()
    return { ...code, id, prev }
}




/**************** JS Importer *****************/

export const parseJsCode = (code, libMappings) => {
    const ast = babelParser.parse(code, { sourceType: 'module', plugins: [ 'jsx' ] })
    return ast.program.body.map(code => parseJsAstNode(code, libMappings))
}

export const parseJsAstNode = (node, libMappings) => {
    const codeWithoutResult = CodeComponent.mapFields({ ui: ui => ui.update({ isResultVisible: false }) })
    if (node.type === 'ExportNamedDeclaration') {
        return CodeComponent.update({
            name: node.declaration.declarations[0].id.name,
            expr: babelGenerator(node.declaration.declarations[0].init).code,
        })
    }
    else if (node.type === 'VariableDeclaration') {
        return CodeComponent.update({
            name: node.declarations[0].id.name,
            expr: babelGenerator(node.declarations[0].init).code,
        })
    }
    else if (node.type === 'ImportDeclaration') {
        return codeWithoutResult.update({
            name: mapImportAssignment(node.specifiers),
            expr: mapImportSource(node.source.value, libMappings)
        })
    }
    else {
        return CodeComponent.update({
            expr: babelGenerator(node).code,
        })
    }
}

const mapImport = node => (
  node.local.name === node.imported.name ?
    node.local.name
  : (
    node.imported.name + ': ' + node.local.name
  )
)

const mapImportSpecifier = node =>
  node.type === "ImportDefaultSpecifier" ?
    `default: ${node.local.name}`
  : node.type === "ImportSpecifier" ?
    mapImport(node)
  :
    generator(node).code


const mapImportAssignment = specifiers =>
  specifiers[0].type === "ImportNamespaceSpecifier" ?
    specifiers[0].local.name
  : (
    "{ " + specifiers.map(mapImportSpecifier).join(", ") + " }"
  )

export const mapImportSource = (source, libMappings) => (
    libMappings[source] || `import(${JSON.stringify(source)})`
)


export const exportJsCode = code =>
    code.toList()
        .map(block =>
            `const ${block.getName()} = ${block.expr}`
        )
        .reverse()
        .join("\n\n")






/**************** REPL *****************/



const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const setCodeExpr = (id, expr, wholeCode) =>
    wholeCode.updateExprWithId(id, expr)

export const switchUsageMode = (id, wholeCode) =>
    wholeCode
        .invalidateWithId(id)
        .mapWithId(
            id,
            code => code.update({
                usageMode: nextElem(code.usageMode, USAGE_MODES),
            }),
        )

export const setName = (id, name, wholeCode) =>
    wholeCode
        .invalidateWithId(id)
        .mapWithid(id, code => code.update({ name }))

export const updateState = (id, stateUpdate, wholeCode) =>
    wholeCode
        .applyWhen(
            code.usageMode === 'use-data',
            code => code.invalidateWithId(id),
        )
        .mapWithId(
            id,
            code => code.update({
                state: runUpdate(stateUpdate, code.state),
            }),
        )

export const switchAutorun = (id, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({ autorun: !code.autorun }),
    )

export const runCode = (id, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({ invalidated: true }),
    )

export const insertBeforeCode = (id, insert, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({
            prev: insert.update({
                id: wholeCode.getNextId(),
                prev: code.prev
            })
        }),
    )

export const insertAfterCode = (id, insert, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => insert.update({ id: wholeCode.getNextId(), prev: code }),
    )

export const deleteCode = (id, wholeCode) =>
    id === wholeCode.id ?
        (wholeCode.prev || CodeComponent)
    :
        wholeCode.mapWithId(id, code => code.prev)

export const resetStateCode = (id, wholeCode) =>
    wholeCode
        .applyWhen(
            code.usageMode === 'use-data',
            code => code.invalidateWithId(id),
        )
        .mapWithId(id, code => code.update({ state: initialBlockState }))

export const updateUIOption = (id, uiUpdater, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.udpate({ ui: uiUpdater(code.ui) }),
    )


export const REPL = ({ code, dispatch }) => {
    const onUpdateExpr    = expr        => dispatch(setCodeExpr,      code.id, expr)
    const onUpdateState   = stateUpdate => dispatch(updateState,      code.id, stateUpdate)
    const onSwitchAutorun = ()          => dispatch(switchAutorun,    code.id)
    const onRun           = ()          => dispatch(runCode,          code.id)
    const onInsertBefore  = ()          => dispatch(insertBeforeCode, code.id, CodeComponent)
    const onInsertAfter   = ()          => dispatch(insertAfterCode,  code.id, CodeComponent)

    const onKeyPress = event => {
        onMetaEnter(onCmdInsert)(event)
        if (event.altKey && event.key === 'Enter') {
            if (event.shiftKey) {
                onSwitchAutorun()
            }
            else {
                onRun()
            }
        }
    }

    const onCmdInsert = event => {
        if (event.shiftKey) {
            onInsertBefore()
        }
        else {
            onInsertAfter()
        }
    }

    return (
        <React.Fragment>
            {code.prev &&
                <REPL code={code.prev} dispatch={dispatch} />
            }
            <REPLLine key={code.id}>
                <REPLUIToggles code={code} dispatch={dispatch} />
                <REPLContent>
                    {code.ui.isNameVisible &&
                        <AssignmentLine code={code} dispatch={dispatch} />
                    }
                    {code.ui.isCodeVisible &&
                        <EditableCode code={code.expr} onUpdate={onUpdateExpr} onKeyPress={onKeyPress} />
                    }
                    {code.ui.isResultVisible &&
                        <ValueViewer value={code.cachedResult} state={code.state} setState={onUpdateState} />
                    }
                    {code.ui.isStateVisible &&
                        <ValueInspector value={code.state} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}


export const AssignmentLine = ({ code, dispatch }) => {
    const onUpdateName    = name => dispatch(setName,       code.id, name)
    const onSwitchAutorun = ()   => dispatch(switchAutorun, code.id)
    const onRun           = ()   => dispatch(runCode,       code.id)

    return (
        <div className="flex self-stretch space-x-2 pr-2 -mb-1 text-slate-500 font-light text-xs">
            <div>
                <VarNameInput
                    value={code.name}
                    onUpdate={onUpdateName}
                    placeholder={code.getDefaultName()}
                />
                &nbsp;=
            </div>

            <div className="flex-1" />

            <button onClick={onSwitchAutorun}>
                {code.autorun || "No "}
                Autorun
            </button>
            <button onClick={onRun}>
                Run
            </button>
        </div>
    )
}




/****************** REPL Popover ******************/

const PopoverPanelStyled = classed(Popover.Panel)`
    flex flex-col
    bg-gray-100
    shadow
    rounded
    items-stretch
    w-max
    text-sm
    overflow-hidden
    z-10
    outline-none
`

const REPLUIToggles = ({ code, dispatch }) => {
    const onInsertBefore    = () => dispatch(insertBeforeCode, code.id, CodeComponent)
    const onInsertAfter     = () => dispatch(insertAfterCode,  code.id, CodeComponent)
    const onReset           = () => dispatch(resetStateCode,   code.id)
    const onSwitchUsageMode = () => dispatch(switchUsageMode,  code.id)
    const onDelete          = () => dispatch(deleteCode,       code.id)

    const Toggle = ({ propName, icon, iconDisabled, label, ...props }) => {
        const onToggle = () =>
            dispatch(
                updateUIOption,
                code.id,
                ui => ({ ...ui, [propName]: !ui[propName] }),
            )

        return (
            <IconToggleButton
                className="w-full"
                isActive={code.ui[propName]}
                icon={icon}
                iconDisabled={iconDisabled}
                onUpdate={onToggle}
                label={`${code.ui[propName] ? "Hide" : "Show"} ${label}`}
                {...props}
            />
        )
    }
    
    const Button = props => (
        <IconToggleButton className="w-full" isActive={true} {...props} />
    )

    const Menu = () => (
        <PopoverPanelStyled className="absolute -right-1 translate-x-full">
            <Toggle propName="isNameVisible"     icon={solidIcons.faICursor}      label="Assignment"         />
            <Toggle propName="isCodeVisible"     icon={solidIcons.faCode}         label="Code"               />
            <Toggle propName="isResultVisible"   icon={solidIcons.faPlay}         label="Result"             />
            <Toggle propName="isStateVisible"    icon={solidIcons.faHdd}          label="State"              />
            <Button onUpdate={onInsertBefore}    icon={solidIcons.faChevronUp}    label="Insert before"      />
            <Button onUpdate={onInsertAfter}     icon={solidIcons.faChevronDown}  label="Insert after"       />
            <Button onUpdate={onSwitchUsageMode} icon={solidIcons.faDollarSign}   label={`Save ${code.usageMode === 'use-result' ? "code result" : "block data"} in ${code.getName()}`} />
            <Button onUpdate={onReset}           icon={solidIcons.faStepBackward} label="Reset Block (data)" />
            <Button onUpdate={onDelete}          icon={solidIcons.faTrash}        label="Delete"             />
        </PopoverPanelStyled>
    )

    return (
        <div>
            <Popover className="relative">
                <Menu />
                <Popover.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Popover.Button>
            </Popover>
        </div>
    )
}
