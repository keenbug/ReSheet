import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { BlockRef } from '../../block'
import * as block from '../../block'
import { getResultValue } from '../../logic/result'

import { Keybindings, useShortcuts } from '../../ui/shortcuts'
import { EUpdater, useEUpdate, useEffectfulState } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'

import { CodeEditor, CodeEditorProps, CodeEditorHandle } from '../../code-editor'
import { useCompletionsOverlay } from '../../code-editor/completions'

import { ViewBlockInstantiated, ViewNote, evaluateNote, getCode, getPrefix, recomputeNote, textClasses } from './note'
import { NoteModel, NoteType } from './versioned'
import * as versioned from './versioned'


const init: NoteModel = {
    level: 0,
    input: '',
    note: evaluateNote('', block.emptyEnv, () => {}),
}

export const Note = block.create<NoteModel>({
    init,
    view({ env, state, update }, ref) {
        return <NoteUi ref={ref} state={state} update={update} env={env} />
    },
    recompute(state, update, env) {
        return recompute(state, update, env)
    },
    getResult(state) {
        switch (state.note.type) {
            case 'expr':
                return getResultValue(state.note.result)

            case 'block':
                if (state.note.isInstantiated) {
                    return state.note.block.getResult(state.note.state)
                }
                else {
                    return undefined
                }

            default:
                return state.note
        }
    },
    fromJSON(json, update, env) {
        return versioned.fromJSON(json)({
            update,
            env,
            modelFromInput(level, input) {
                const updateNote = block.fieldUpdater('note', update)
                const note = evaluateNote(input, env, updateNote)
                return recompute({ level, input, note }, update, env)
            },
        })
    },
    toJSON(state) {
        return versioned.toJSON(state)
    }
})



interface NoteUiProps {
    state: NoteModel
    update: block.BlockUpdater<NoteModel>
    env: block.Environment
}

export const NoteUi = React.forwardRef(
    function NoteUi(
        { state, update, env }: NoteUiProps,
        ref: React.Ref<BlockRef>
    ) {
        const editorRef = React.useRef<CodeEditorHandle>()
        const blockRef = React.useRef<BlockRef>()
        const eupdate = useEUpdate(update, env)
        const [isFocused, setFocused] = React.useState(false)
        const completions = useCompletionsOverlay(editorRef, getCode(state.note) ?? '', env, getPrefix(state.note).length)

        React.useEffect(() => {
            if (isFocused) {
                editorRef.current?.element?.focus()
            }
        }, [isFocused, editorRef])

        React.useImperativeHandle(
            ref,
            () => ({
                focus(options) {
                    if (state.note.type === 'block' && state.note.isInstantiated === true) {
                        blockRef.current?.focus(options)
                    }
                    else {
                        setFocused(true)
                    }
                }
            })
        )

        const updateNote = React.useMemo(() => block.fieldUpdater('note', update), [update])

        const isCode = (
            state.note.type === 'expr'
            || (state.note.type === 'block' && !state.note.isInstantiated)
        )

        const actions = React.useMemo(() => ACTIONS(update, eupdate, blockRef), [update, eupdate, blockRef])
        const shortcutProps = useShortcuts([
            ...isCode ? completions.shortcuts : [],
            ...keybindings(state, actions),
        ])

        function onUpdateCode(input: string){
            update(state =>
                recompute({ ...state, input }, update, env)
            )
        }

        const preventEnter = React.useCallback(function preventEnter(event: React.KeyboardEvent) {
            if (getFullKey(event) === 'Enter') {
                event.preventDefault()
            }
            shortcutProps.onKeyDown(event)
        }, [shortcutProps])

        if (state.note.type === 'block' && state.note.isInstantiated === true) {
            return <ViewBlockInstantiated ref={blockRef} note={state.note} update={updateNote} env={env} />
        }
        
        return (
            <div
                className="flex flex-col py-0.5 space-y-1 flex-1"
                tabIndex={-1}
                style={{ paddingLeft: (1.5 * state.level) + 'rem' }}
                onFocus={event => {
                    setFocused(true)
                    shortcutProps.onFocus(event)
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(false)
                    }
                    completions.onBlur(event)
                    shortcutProps.onBlur(event)
                }}
            >
                {(isFocused || isCode) && 
                    <NoteEditor
                        ref={editorRef}
                        note={state.note}
                        code={state.input}
                        onUpdate={onUpdateCode}
                        {...shortcutProps}
                        onKeyDown={preventEnter}
                        spellCheck={!isCode}
                        />
                }
                {(!isFocused || isCode) &&
                    <ViewNote
                        note={state.note}
                        env={env}
                        isFocused={isFocused}
                        actions={actions}
                        />
                }
                {isCode && completions.ui}
            </div>
        )
    }
)



function keybindings(state: NoteModel, actions: ReturnType<typeof ACTIONS>): Keybindings {
    return [
        {
            description: "Note",
            bindings: [
                [
                    state.note.type === 'checkbox' ? ["C-Enter"] : [],
                    "none",
                    "toggle checkbox",
                    actions.toggleCheckbox,
                ],
                [
                    state.note.type === 'block' && !state.note.isInstantiated ? ["C-Enter"] : [],
                    "none",
                    "use this block",
                    actions.instantiateBlock,
                ],
                [
                    ["Tab"],
                    "none",
                    "indent",
                    actions.indent,
                ],
                [
                    ["Shift-Tab"],
                    "none",
                    "outdent",
                    actions.outdent,
                ]
            ]
        }
    ]
}

function ACTIONS(update: block.BlockUpdater<NoteModel>, eupdate: EUpdater<NoteModel>, blockRef: React.RefObject<BlockRef>) {
    return {
        toggleCheckbox() {
            update(state => {
                if (state.note.type === 'checkbox') {
                    return {
                        ...state,
                        input: state.input.replace(
                            /^\[[ xX]?\] /,
                            state.note.checked ? "[ ] " : "[x] "
                        ),
                        note: {
                            ...state.note,
                            checked: !state.note.checked,
                        }
                    }
                }
                return state
            })
        },

        instantiateBlock() {
            eupdate((state, env) => {
                if (state.note.type !== 'block') { return {} }
                if (state.note.isInstantiated === true) { return {} }
                if (state.note.result.type !== 'immediate') { return {} }
                if (!block.isBlock(state.note.result.value)) { return {} }

                const updateBlockState = block.updateCaseField({ type: 'block', isInstantiated: true }, 'state', update)

                let innerState = state.note.result.value.init
                try {
                    innerState = state.note.result.value.fromJSON(state.note.lastState, updateBlockState, env)
                }
                catch (e) { /* do nothing */ }

                return {
                    state: {
                        ...state,
                        note: {
                            type: 'block',
                            isInstantiated: true,
                            code: state.note.code,
                            block: state.note.result.value,
                            state: innerState,
                        },
                    },
                    effect() {
                        blockRef.current?.focus()
                    },
                }
            })
        },

        indent() {
            update(state => ({
                ...state,
                level: state.level + 1,
            }))
        },

        outdent() {
            update(state => ({
                ...state,
                level: Math.max(0, state.level - 1),
            }))
        },
    }
}



export function recompute(state: NoteModel, update: block.BlockUpdater<NoteModel>, env: block.Environment): NoteModel {
    return {
        ...state,
        note: recomputeNote(state.input, state.note, block.fieldUpdater('note', update), env),
    }
}



type NodeEditorProps = Omit<CodeEditorProps, 'language' | 'container' | 'className' | 'style'> & {
    note: NoteType
    onUpdate: (code: string) => void
}

export const NoteEditor = React.forwardRef(
    function NoteEditor(
        { note, code, onKeyDown, ...props }: NodeEditorProps,
        ref: React.Ref<CodeEditorHandle>
    ) {
        const [style, className, language] = editorStyle(note)

        function ignoreEmptyBackspace(event: KeyboardEvent) {
            if (event.key === 'Backspace' && code.length === 0) {
                event.preventDefault()
            }
            onKeyDown?.(event)
        }

        return (
            <div className="relative group/note-editor">
                <CodeEditor
                    ref={ref}
                    code={code}
                    language={language}
                    container="div"
                    className={className}
                    style={style}
                    onKeyDown={ignoreEmptyBackspace}
                    {...props}
                    />
                <div className="absolute top-1 right-0 flex ">
                    <NoteTypeIndicator noteType={note.type} />
                </div>
            </div>
        )
    }
)

function NoteTypeIndicator({ noteType }: { noteType: NoteType["type"] }) {
    switch (noteType) {
        case 'block':
            return (
                <div className="text-xs rounded px-1 bg-sky-100 group-focus-within/note-editor:bg-sky-400 text-white cursor-default">
                    block
                </div>
            )

        case 'expr':
            return (
                <div className="bg-amber-100 group-focus-within/note-editor:bg-amber-300 text-white w-4 h-4 rounded text-center font-bold cursor-default">
                    <span className="inline-block translate-y-[-.34rem]">=</span>
                </div>
            )

        default:
            return null
    }
}

const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
}

function editorStyle(note: NoteType): [React.CSSProperties, string, string] {
    switch (note.type) {
        case 'expr':
            return [codeStyle, "", "jsx"]

        case 'block':
            return [codeStyle, "", "jsx"]

        case 'text':
            return [{}, textClasses[note.tag] ?? "", "markdown"]

        case 'checkbox':
            return [{}, "", "markdown"]
    }
}
