import * as React from 'react'

import { Set, remove } from 'immutable'

import { BlockHandle } from '@resheet/core/block'
import * as Block from '@resheet/core/block'

import { CodeEditor, CodeEditorProps, CodeEditorHandle } from '@resheet/code/editor'
import { useCompletionsOverlay } from '@resheet/code/completions'

import { getResultValue } from '@resheet/code/result'

import { Keybindings, useShortcuts } from '@resheet/util/shortcuts'
import { useStableCallback } from '@resheet/util/hooks'
import { fieldDispatcher } from '@resheet/util/dispatch'

import { getFullKey } from '../utils/ui'

import { isSafeBlock, safeBlock } from '../component'

import { ViewBlockInstantiated, ViewNote, evaluateNote, getCode, getPrefix, recomputeNote, textClasses } from './note'
import { NoteModel, NoteType } from './versioned'
import * as versioned from './versioned'


const init: NoteModel = {
    level: 0,
    input: '',
    note: evaluateNote('', Block.emptyEnv, () => {}),
}

export const Note = Block.create<NoteModel>({
    init,
    view({ env, state, dispatch }, ref) {
        return <NoteUi ref={ref} state={state} dispatch={dispatch} env={env} />
    },
    recompute(state, dispatch, env, changedVars) {
        return recompute(state, dispatch, env, changedVars)
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
    fromJSON(json, dispatch, env) {
        return versioned.fromJSON(json)({
            dispatch,
            env,
            modelFromInput(level, input) {
                const dispatchNote = fieldDispatcher('note', dispatch)
                const note = evaluateNote(input, env, dispatchNote)
                return recompute({ level, input, note }, dispatch, env, null).state
            },
        })
    },
    toJSON(state) {
        return versioned.toJSON(state)
    }
})



interface NoteUiProps {
    state: NoteModel
    dispatch: Block.BlockDispatcher<NoteModel>
    env: Block.Environment
}

export const NoteUi = React.forwardRef(
    function NoteUi(
        { state, dispatch, env }: NoteUiProps,
        ref: React.Ref<BlockHandle>
    ) {
        const editorRef = React.useRef<CodeEditorHandle>()
        const blockRef = React.useRef<BlockHandle>()
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

        const dispatchNote = React.useMemo(() => fieldDispatcher('note', dispatch), [dispatch])

        const isCode = (
            state.note.type === 'expr'
            || (state.note.type === 'block' && !state.note.isInstantiated)
        )

        const actions = React.useMemo(() => ACTIONS(dispatch, blockRef), [dispatch, blockRef])
        const shortcutProps = useShortcuts([
            ...isCode ? completions.shortcuts : [],
            ...keybindings(state, actions),
        ])

        const onUpdateCode = React.useCallback(function onUpdateCode(input: string) {
            dispatch((state, { env }) => ({
                state: recompute({ ...state, input }, dispatch, env, null).state,
            }))
        }, [dispatch])

        const preventEnter = React.useCallback(function preventEnter(event: React.KeyboardEvent) {
            if (getFullKey(event) === 'Enter') {
                event.preventDefault()
            }
            shortcutProps.onKeyDown(event)
        }, [shortcutProps.onKeyDown])

        if (state.note.type === 'block' && state.note.isInstantiated === true) {
            return <ViewBlockInstantiated ref={blockRef} note={state.note} dispatch={dispatchNote} env={env} />
        }
        
        return (
            <div
                className="flex flex-col space-y-1"
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
                    [['block', 'expr'].includes(state.note.type) ? "Alt-Tab" : "Tab"],
                    "none",
                    "indent right",
                    actions.indentRight,
                ],
                [
                    [['block', 'expr'].includes(state.note.type) ? "Shift-Alt-Tab" : "Shift-Tab"],
                    "none",
                    "indent left",
                    actions.indentLeft,
                ]
            ]
        }
    ]
}

function ACTIONS(dispatch: Block.BlockDispatcher<NoteModel>, blockRef: React.RefObject<BlockHandle>) {
    return {
        toggleCheckbox() {
            dispatch(state => {
                if (state.note.type === 'checkbox') {
                    return {
                        state: {
                            ...state,
                            input: state.input.replace(
                                /^\[[ xX]?\] /,
                                state.note.checked ? "[ ] " : "[x] "
                            ),
                            note: {
                                ...state.note,
                                checked: !state.note.checked,
                            }
                        },
                        description: "toggled checkbox",
                    }
                }
                return { state }
            })
        },

        instantiateBlock() {
            dispatch((state, env) => {
                if (state.note.type !== 'block') { return { state } }
                if (state.note.isInstantiated === true) { return { state } }
                if (state.note.result.type !== 'immediate') { return { state } }
                if (!Block.isBlock(state.note.result.value)) { return { state } }

                const dispatchBlockState = Block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

                const value = state.note.result.value
                const block = isSafeBlock(value) ? value.$$UNSAFE_BLOCK : value

                let innerState = block.init
                try {
                    if ('lastState' in state.note) {
                        innerState = block.fromJSON(state.note.lastState, dispatchBlockState, env)
                    }
                }
                catch (e) { /* do nothing */ }

                return {
                    state: {
                        ...state,
                        note: {
                            type: 'block',
                            isInstantiated: true,
                            code: state.note.code,
                            deps: state.note.deps,
                            block: safeBlock(block),
                            state: innerState,
                        },
                    },
                    effect() {
                        blockRef.current?.focus()
                    },
                }
            })
        },

        resetBlock() {
            dispatch(state => {
                if (state.note.type !== 'block') { return { state } }
                if (state.note.isInstantiated === true) { return { state } }

                return {
                    state: {
                        ...state,
                        note: remove(state.note, 'lastState'),
                    },
                }
            })
        },

        indentRight() {
            dispatch(state => ({
                state: {
                    ...state,
                    level: state.level + 1,
                },
            }))
        },

        indentLeft() {
            dispatch(state => ({
                state: {
                    ...state,
                    level: Math.max(0, state.level - 1),
                },
            }))
        },
    }
}



export function recompute(
    state: NoteModel,
    dispatch: Block.BlockDispatcher<NoteModel>,
    env: Block.Environment,
    changedVars: Set<string> | null,
): {
    state: NoteModel,
    invalidated: boolean,
} {
    const { state: note, invalidated } = recomputeNote(state.input, state.note, fieldDispatcher('note', dispatch), env, changedVars)
    return {
        state: { ...state, note },
        invalidated,
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

        const ignoreEmptyBackspace = useStableCallback(function ignoreEmptyBackspace(event: KeyboardEvent) {
            if (event.key === 'Backspace' && code.length === 0) {
                event.preventDefault()
            }
            onKeyDown?.(event)
        })

        return (
            <div className="relative group/note-editor">
                <CodeEditor
                    ref={ref}
                    code={code}
                    language={language}
                    container="div"
                    className={`whitespace-pre-wrap outline-none ${className}`}
                    style={style}
                    onKeyDown={ignoreEmptyBackspace}
                    {...props}
                    />
                <div className="absolute top-1 right-0">
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
                <div className="text-xs rounded px-1 bg-sky-100 group-focus-within/note-editor:bg-sky-400 text-white cursor-default overflow-clip">
                    block
                </div>
            )

        case 'expr':
            return (
                <div className="bg-amber-100 group-focus-within/note-editor:bg-amber-300 text-white w-4 h-4 rounded text-center font-bold cursor-default overflow-clip">
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
