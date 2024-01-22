import * as React from 'react'
import styled, { css } from 'styled-components'

import { classed } from '../ui/utils'
import { Highlight } from 'prism-react-renderer'
import theme from './theme'
import { useEditable } from './useEditable'


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

const CodeContent = classed<any>(CodeWithPlaceholder)`
    block
    rounded
    hover:bg-gray-100 focus:bg-gray-100
    break-word
`

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


export interface CodeEditorProps extends CodeViewProps {
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

        return (
            <CodeView
                ref={codeViewRef}
                code={code}
                style={style ?? {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
                {...props}
                />
        )
    }
)

export const EditableCode = CodeEditor