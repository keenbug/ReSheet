import * as React from 'react'

import { CodeEditor, CodeEditorProps } from '../../code-editor'
import { BlockRef } from '../../block'
import * as block from '../../block'
import { Keybindings, useShortcuts } from '../../ui/shortcuts'
import { EffectfulUpdater, useEffectfulState, useEffectfulUpdate } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'
import { assertValid, defined, number, string, validate } from '../../utils/validate'
import { Note, ViewNote, evaluateNote, noteFromJSON, noteToJSON, recomputeNote, textClasses } from './note'
import { getResultValue } from '../../logic/result'


export interface NoteModel {
    level: number
    input: string
    note: Note
}

const init: NoteModel = {
    level: 0,
    input: '',
    note: evaluateNote('', block.emptyEnv, () => {}),
}

export { NoteBlock as Note }
const NoteBlock = block.create<NoteModel>({
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
        assertValid({ level: number, input: string }, json)

        if (validate({ v: 0, note: defined }, json)) {
            const note = noteFromJSON(json.note, block.fieldUpdater('note', update), env)

            return {
                level: json.level,
                input: json.input,
                note,
            }
        }
        else if (validate({ interpreted: defined }, json)) {
            const note = noteFromJSON(json.interpreted, block.fieldUpdater('note', update), env)

            return {
                level: json.level,
                input: json.input,
                note,
            }
        }
        else {
            const note = evaluateNote(json.input, env, block.fieldUpdater('note', update))

            return recompute(
                {
                    level: json.level,
                    input: json.input,
                    note,
                },
                update,
                env,
            )
        }
    },
    toJSON(state) {
        return { v: 0, level: state.level, input: state.input, note: noteToJSON(state.note) }
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
        const editorRef = React.useRef<HTMLDivElement>()
        const blockRef = React.useRef<BlockRef>()
        const updateFX = useEffectfulUpdate(update)
        const [isFocused, setFocused] = useEffectfulState(false)

        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    if (state.note.type === 'block' && state.note.isInstantiated === true) {
                        blockRef.current?.focus()
                    }
                    else {
                        setFocused(() => ({
                            state: true,
                            effect() { editorRef.current?.focus() }
                        }))
                    }
                }
            })
        )

        const updateBlock = React.useCallback(function updateBlock(action: (state: unknown) => unknown) {
            update(state => {
                if (state.note.type !== 'block') { return state }
                if (!state.note.isInstantiated) { return state }
                return {
                    ...state,
                    note: { ...state.note, state: action(state.note.state) },
                }
            })
        }, [update])

        const actions = React.useMemo(() => ACTIONS(update, updateFX, blockRef), [update, updateFX, blockRef])
        const shortcutProps = useShortcuts(keybindings(state, actions))

        const onUpdateCode = (code: string) => update(state => recompute({ ...state, input: code }, update, env))

        const preventEnter = React.useCallback(function preventEnter(event: React.KeyboardEvent) {
            if (getFullKey(event) === 'Enter') {
                event.preventDefault()
            }
            shortcutProps.onKeyDown(event)
        }, [shortcutProps])

        const isCode = (
            state.note.type === 'expr'
            || (state.note.type === 'block' && !state.note.isInstantiated)
        )

        if (state.note.type === 'block' && state.note.isInstantiated === true) {
            return state.note.block.view({
                state: state.note.state,
                update: updateBlock,
                env,
                ref: blockRef,
            })
        }
        
        return (
            <div
                className="flex flex-col py-0.5 space-y-1 flex-1"
                tabIndex={-1}
                style={{ paddingLeft: (1.5 * state.level) + 'rem' }}
                onClick={() => {
                    setFocused(() => ({
                        state: true,
                        effect() { editorRef.current?.focus() }
                    }))
                }}
                onFocus={event => {
                    setFocused(() => ({ state: true }))
                    shortcutProps.onFocus(event)
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(() => ({ state: false }))
                    }
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

function ACTIONS(update: block.BlockUpdater<NoteModel>, updateFX: EffectfulUpdater<NoteModel>, blockRef: React.RefObject<BlockRef>) {
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
            updateFX(state => {
                if (state.note.type !== 'block') { return {} }
                if (state.note.isInstantiated === true) { return {} }
                if (state.note.result.type !== 'immediate') { return {} }
                if (!block.isBlock(state.note.result.value)) { return {} }
                return {
                    state: {
                        ...state,
                        note: {
                            type: 'block',
                            isInstantiated: true,
                            code: state.note.code,
                            block: state.note.result.value,
                            state: state.note.result.value.init,
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



function recompute(state: NoteModel, update: block.BlockUpdater<NoteModel>, env: block.Environment): NoteModel {
    return {
        ...state,
        note: recomputeNote(state.input, state.note, block.fieldUpdater('note', update), env),
    }
}



type NodeEditorProps = Omit<CodeEditorProps, 'language' | 'container' | 'className' | 'style'> & {
    note: Note
    onUpdate: (code: string) => void
}

export const NoteEditor = React.forwardRef(
    function NoteEditor(
        { note, ...props }: NodeEditorProps,
        ref: React.Ref<HTMLDivElement>
    ) {
        const [style, className, language] = editorStyle(note)

        return (
            <CodeEditor
                ref={ref}
                language={language}
                container="div"
                className={className}
                style={style}
                {...props}
                />
        )
    }
)

const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
}

function editorStyle(note: Note): [React.CSSProperties, string, string] {
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
