import * as React from 'react'

import Editor from 'react-simple-code-editor'

import { highlightJS, highlightMd } from '../../ui/code-editor'
import { BlockRef } from '../../block'
import * as block from '../../block'
import { Keybindings, useShortcuts } from '../../ui/shortcuts'
import { useEffectfulState } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'
import { assertValid, defined, number, string, validate } from '../../utils/validate'
import { Note, ViewNote, evaluateNote, noteFromJSON, noteToJSON, textClasses } from './note'
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
        if (state.note.type === 'block' && state.note.isInstantiated) {
            return <BlockUi ref={ref} state={state} update={update} env={env} />
        }
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
        const editorRef = React.useRef<HTMLTextAreaElement>()
        const [isFocused, setFocused] = useEffectfulState(false)
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    setFocused(() => ({
                        state: true,
                        effect() { editorRef.current?.focus() }
                    }))
                }
            })
        )

        const actions = React.useMemo(() => ACTIONS(update), [update])
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


export const BlockUi = React.forwardRef(
    function BlockUi(
        { state, update, env}: NoteUiProps,
        ref: React.Ref<BlockRef>,
    ) {
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
        if (state.note.type !== 'block') { return null }
        if (!state.note.isInstantiated) { return null }

        return state.note.block.view({
            state: state.note.state,
            update: updateBlock,
            env,
            ref,
        })
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

function ACTIONS(update: block.BlockUpdater<NoteModel>) {
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
            update(state => {
                if (state.note.type !== 'block') { return state }
                if (state.note.isInstantiated === true) { return state }
                if (state.note.result.type !== 'immediate') { return state }
                if (!block.isBlock(state.note.result.value)) { return state }
                return {
                    ...state,
                    note: {
                        type: 'block',
                        isInstantiated: true,
                        code: state.note.code,
                        block: state.note.result.value,
                        state: state.note.result.value.init,
                    }
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
    if (state.note.type === 'expr' && state.note.result.type === 'promise') {
        state.note.result.cancel()
    }
    else if (state.note.type === 'block' && state.note.isInstantiated === false && state.note.result.type === 'promise') {
        state.note.result.cancel()
    }

    return {
        ...state,
        note: evaluateNote(state.input, env, block.fieldUpdater('note', update)),
    }
}



type EditorProps = React.ComponentProps<typeof Editor>
type EditorDefaultProps = keyof typeof Editor.defaultProps
type NoteEditorControlledProps = 'value' | 'onValueChange' | 'highlight'

type NodeEditorProps = Omit<EditorProps, NoteEditorControlledProps | EditorDefaultProps> & {
    note: Note
    code: string
    onUpdate: (code: string) => void
}

export const NoteEditor = React.forwardRef(
    function NoteEditor(
        {
            note, code, onUpdate,
            ...props
        }: NodeEditorProps,
        ref: React.Ref<HTMLTextAreaElement>
    ) {
        const id = React.useId()
        React.useImperativeHandle(ref, () => document.getElementById(id) as HTMLTextAreaElement, [id])

        const [style, className, highlight] = editorStyle(note)

        return (
            <Editor
                value={code}
                onValueChange={onUpdate}
                highlight={highlight}
                autoFocus={false}
                className={className}
                textareaId={id}
                textareaClassName="focus-visible:outline-none"
                style={style}
                {...props}
                />
        )
    }
)

const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
}

function editorStyle(note: Note): [React.CSSProperties, string, (code: string) => string] {
    switch (note.type) {
        case 'expr':
            return [codeStyle, "", highlightJS]

        case 'block':
            return [codeStyle, "", highlightJS]

        case 'text':
            return [{}, textClasses[note.tag] ?? "", highlightMd]

        case 'checkbox':
            return [{}, "", highlightMd]
    }
}
