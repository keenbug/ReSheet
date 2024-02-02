import * as React from 'react'
import styled, { css } from 'styled-components'

import { classed, getFullKey } from '../ui/utils'
import { Highlight } from 'prism-react-renderer'
import theme from './theme'
import { Editable, changeLinesContainingSelection, splitByPosition, useEditable } from './useEditable'
import { clampBetween } from '../utils'


/**************** Code Editor *****************/

const CodeWithPlaceholder = styled.code`
    ${({ placeholder }) =>
        placeholder ?
            css`
                &:empty:after {
                    content: "${placeholder}";
                    color: #bbb;
                    font-size: 0.75rem;
                }
            `
        :
            ''
    }
`

const CodeContent = classed<any>(CodeWithPlaceholder)`block break-word`

// FIXME: I think the type is not 100% correct, theoretically it should reject container="div"
export type CodeViewProps<ContainerType extends React.ComponentType = typeof CodeContent> = React.ComponentPropsWithoutRef<ContainerType> & {
    code: string
    container?: ContainerType
    language?: string
    placeholder?: string
}

export const CodeView = React.forwardRef<HTMLElement, CodeViewProps>(
    function CodeView(
        {
            code,
            container: Container = CodeContent,
            language = 'jsx',
            placeholder = '<code/>',
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
                        className={`whitespace-pre-wrap outline-none ${className}`}
                        style={{
                            ...highlightStyle,
                            ...style,
                        }}
                        placeholder={placeholder}
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
)


export type CodeEditorProps = CodeViewProps & {
    onUpdate: (code: string) => void
}

export const CodeEditor = React.forwardRef(
    function CodeEditor(
        {
            code,
            onUpdate,
            style,
            ...props
        }: CodeEditorProps,
        ref: React.Ref<HTMLElement>
    ) {
        const codeViewRef = React.useRef<HTMLElement>()
        const onChange = React.useCallback((code: string) =>
            // Contenteditable needs an extra newline at the end to work
            // CodeView inserts a newline at the end, but it's not part of the state (code), so remove it
            onUpdate(code.slice(0, -1))
        , [onUpdate])
        const editable = useEditable(codeViewRef, onChange)
        React.useImperativeHandle(ref, () => codeViewRef.current, [codeViewRef.current])

        const onKeyDown = React.useCallback(function onKeyDown(event: React.KeyboardEvent) {
            props.onKeyDown?.(event)
            if (event.isDefaultPrevented() || event.isPropagationStopped()) { return }

            indentationHandlers(event, editable)
        }, [editable, props.onKeyDown])

        const codeLines = code.split('\n').length
        const backgroundOpacity = clampBetween(0, 1, (codeLines - 3) / 5)
        const [indicatorWidth, indicatorColor] = (
            codeLines > 3 ?
                [
                    clampBetween(0, .25, codeLines / 40) + 'rem',
                    `rgba(125, 211, 252, ${clampBetween(0, 1, (codeLines - 3) / 20 + .4)})`, // = sky-300/[${...}]
                ]
            :
                ['0', 'transparent']
        )

        return (
            <CodeView
                ref={codeViewRef}
                code={code}
                style={style ?? {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    boxShadow: `inset -${indicatorWidth} 0 0 0 ${indicatorColor}`,
                    '--tw-gradient-to': `rgb(240, 249, 255, ${backgroundOpacity}) var(--tw-gradient-to-position)`, // = to-sky-50/[${backgroundOpacity}]
                }}
                {...props}
                className={`
                    focus-within/code-editor:bg-gradient-to-r
                    from-transparent from-10%
                    ${props.className}
                `}
                onKeyDown={onKeyDown}
                />
        )
    }
)

export function indentationHandlers(event: React.KeyboardEvent<Element>, editable: Editable, indentation: string = '  ') {
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
