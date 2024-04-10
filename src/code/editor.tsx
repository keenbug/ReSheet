import * as React from 'react'

import { Highlight } from 'prism-react-renderer'

import { clampBetween } from '@resheet/util'
import { useStable } from '@resheet/util/hooks'
import { getFullKey } from '@resheet/util/shortcuts'

import theme from './theme'
import { Editable, changeLinesContainingSelection, splitByPosition, useEditable } from './useEditable'


// FIXME: I think the type is not 100% correct, theoretically it should reject container="div"
export type CodeViewProps<ContainerType extends React.ComponentType> = React.ComponentPropsWithoutRef<ContainerType> & {
    code: string
    container?: ContainerType
    language?: string
}

export const CodeView = React.memo(React.forwardRef<HTMLElement, CodeViewProps<any>>(
    function CodeView(
        {
            code,
            container: Container = 'code',
            language = 'jsx',
            className = '',
            style = {},
            ...props
        },
        ref,
    ) {
        return (
            <Highlight
                code={code}
                theme={theme}
                language={language ?? "jsx"}
            >
                {({ style: highlightStyle, tokens, getLineProps, getTokenProps }) => (
                    <Container
                        ref={ref}
                        tabIndex={-1}
                        spellCheck={false}
                        className={className || 'whitespace-pre outline-none'}
                        style={{
                            ...highlightStyle,
                            ...style,
                        }}
                        {...props}
                    >
                        {tokens.map((line, i) => (
                            <span key={i} {...getLineProps({ line })}>
                                {line
                                    .filter(token => !token.empty)
                                    .map((token, key) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                    ))
                                }
                                {'\n'}
                            </span>
                        ))}
                    </Container>
                )}
            </Highlight>
        )
    }
))


export type CodeEditorProps = CodeViewProps<any> & {
    onUpdate: (code: string) => void
}

export interface CodeEditorHandle {
    editable: Editable,
    element: HTMLElement,
}

export const CodeEditor = React.forwardRef(
    function CodeEditor(
        {
            code,
            onUpdate,
            ...props
        }: CodeEditorProps,
        ref: React.Ref<CodeEditorHandle>
    ) {
        const codeViewRef = React.useRef<HTMLElement>()
        const onChange = React.useCallback((code: string) =>
            // Contenteditable needs an extra newline at the end to work
            // CodeView inserts a newline at the end, but it's not part of the state (code), so remove it
            onUpdate(code.slice(0, -1))
        , [onUpdate])
        const editable = useEditable(codeViewRef, onChange)
        React.useImperativeHandle(ref,
            () => ({
                editable,
                element: codeViewRef.current,
            }),
            [editable, codeViewRef.current],
        )

        const onKeyDown = React.useCallback(function onKeyDown(event: React.KeyboardEvent) {
            combineHandlers(event,
                () => props.onKeyDown?.(event),
                () => indentationHandlers(event, editable),
                () => arrowHandler(event, editable),
            )
        }, [editable, props.onKeyDown])

        return (
            <CodeView
                ref={codeViewRef}
                code={code}
                {...props}
                onKeyDown={onKeyDown}
                />
        )
    }
)

function combineHandlers(event: React.UIEvent, ...handlers: Array<() => void>) {
    for (const handler of handlers) {
        handler()
        if (event.isPropagationStopped()) { return }
    }
}

export function indentationHandlers(event: React.KeyboardEvent<Element>, editable: Editable, indentation: string = '  ') {
    if (event.defaultPrevented) { return }
    switch (getFullKey(event)) {
        case 'Enter': {
            event.preventDefault()
            event.stopPropagation()
            const { position, text } = editable.getState()
            const { lineBefore } = splitByPosition(text, position)
            const indentationMatch = /^\s*/.exec(lineBefore)
            editable.edit('\n' + indentationMatch[0])
            return
        }

        case 'Tab': {
            event.preventDefault()
            event.stopPropagation()
            changeLinesContainingSelection(
                editable,
                lines =>
                    lines.map(line =>
                        indentation + line
                )
            )
            return
        }

        case 'Shift-Tab': {
            event.preventDefault()
            event.stopPropagation()
            changeLinesContainingSelection(
                editable,
                lines =>
                    lines.map(line =>
                        line.startsWith(indentation) ?
                            line.slice(indentation.length)
                        :
                            line
                )
            )
            return
        }
    }
}

export function arrowHandler(event: React.KeyboardEvent, editable: Editable) {
    switch (event.key) {
        case 'ArrowDown': {
            const { position, text } = editable.getState()
            if (position.start === position.end && position.end === text.length - 1) { // text contains an extra '\n'
                // there is no default action - some other handler is allowed to react to ArrowDown
                event.preventDefault()
            }
            return
        }

        case 'ArrowUp': {
            const { position } = editable.getState()
            if (position.start === position.end && position.end === 0) {
                // there is no default action - some other handler is allowed to react to ArrowUp
                event.preventDefault()
            }
            return
        }
    }
}
