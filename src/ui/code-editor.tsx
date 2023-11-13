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


export const CodeView: React.FC<any> = ({ code, container, highlight = highlightJS, ...props }) => {
    const ref = React.useRef(null)

    const Container = container ?? CodeContent
    return (
        <pre>
            <Container
                ref={ref}
                style={{ minHeight: "1.5rem" }}
                dangerouslySetInnerHTML={{ __html: highlight(code) }}
                placeholder="<code/>"
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
}

export const CodeEditor = React.forwardRef(
    function CodeEditor(
        { code, onUpdate, highlight = highlightJS, ...props }: CodeEditorProps,
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
                className="focus-within:bg-gray-100"
                textareaId={id}
                textareaClassName="focus-visible:outline-none"
                preClassName={`
                    ${code.trim() === "" && "before:content-['<code/>']"}
                    before:text-gray-300 before:text-xs
                `}
                style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}
                {...props}
                />
        )
    }
)

export const highlightNothing = code => new Option(code).innerHTML

export const highlightJS = code => (
    Prism.highlight(
        code,
        Prism.languages.javascript,
        'javascript'
    )
)

export const EditableCode = CodeEditor