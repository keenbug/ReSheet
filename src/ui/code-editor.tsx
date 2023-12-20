import * as React from 'react'
import styled, { css } from 'styled-components'

import Prism from 'prismjs'
import Editor from 'react-simple-code-editor'

import { classed } from './utils'


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


export const CodeView: React.FC<any> = ({ code, container, highlight = highlightJS, placeholder = '<code/>', ...props }) => {
    const ref = React.useRef(null)

    const Container = container ?? CodeContent
    return (
        <pre>
            <Container
                ref={ref}
                style={{ minHeight: "1.5rem" }}
                dangerouslySetInnerHTML={{ __html: highlight(code) }}
                placeholder={placeholder}
                {...props}
            />
        </pre>
    )
}


type EditorProps = React.ComponentProps<typeof Editor>
type EditorDefaultProps = keyof typeof Editor.defaultProps
type CodeEditorControlledProps = 'value' | 'onValueChange' | 'highlight'

type CodeEditorProps = Omit<EditorProps, CodeEditorControlledProps | EditorDefaultProps> & {
    code: string
    onUpdate: (code: string) => void
    highlight?: (code: string) => string
    placeholder?: string
}

export const CodeEditor = React.forwardRef(
    function CodeEditor(
        {
            code, onUpdate, highlight = highlightJS,
            placeholder = '<code/>', className = '', preClassName = '',
            ...props
        }: CodeEditorProps,
        ref: React.Ref<HTMLTextAreaElement>
    ) {
        const id = React.useMemo(() => 'editor-' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), [])
        React.useImperativeHandle(ref, () => document.getElementById(id) as HTMLTextAreaElement, [id])

        return (
            <Editor
                value={code}
                onValueChange={onUpdate}
                highlight={highlight}
                autoFocus={false}
                className={`focus-within:bg-gray-100 ${className}`}
                textareaId={id}
                textareaClassName="focus-visible:outline-none"
                preClassName={`
                    ${code.trim() === "" && `before:content-['${placeholder}']`}
                    before:text-gray-300 before:text-xs
                    ${preClassName}
                `}
                style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}
                {...props}
                />
        )
    }
)

export const highlightNothing = (code: string) => new Option(code).innerHTML

export const highlightJS = (code: string): string => (
    Prism.highlight(
        code,
        Prism.languages.javascript,
        'javascript'
    )
)

export const EditableCode = CodeEditor