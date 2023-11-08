import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { css } from 'styled-components'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { interpolate } from '../utils'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'


type ClassedElemType<P> = React.FunctionComponent<P> | React.ComponentClass<P> | string

export const classed = <P extends { className?: string }>(
    elem: ClassedElemType<P>
) => (strings: TemplateStringsArray, ...interpolations: Array<any>) =>
    React.forwardRef<unknown, P>((props, ref) =>
        React.createElement(
            elem,
            {
                ...props,
                ref,
                className: `${interpolate(strings, interpolations, props)} ${props.className ?? ""}`,
            }
        )
    )




const TextInputHTML = styled.span`
    ${({ placeholder }) =>
        placeholder ?
            css`
                &:empty:after {
                    content: "${placeholder}";
                    color: #aaa;
                }
            `
        :
            ''
    }
`

const space = String.fromCharCode(32)
const fixedWidth = String.fromCharCode(160)
const fixedWidthToSpace = str => str.replaceAll(fixedWidth, space)

export const TextInput: React.FC<any> = ({ value, onUpdate, ...props }) => {
    const ref = React.useRef(null)
    React.useLayoutEffect(() => {
        if (fixedWidthToSpace(ref.current.textContent) !== fixedWidthToSpace(value)) {
            ref.current.textContent = fixedWidthToSpace(value)
        }
    })
    const onInput = event => {
        const { textContent } = event.target
        const text = fixedWidthToSpace(textContent.replaceAll('\n', ''))
        onUpdate(text)
    }
    return (
        <TextInputHTML
            contentEditable="plaintext-only"
            ref={ref}
            onInput={onInput}
            spellcheck={false}
            {...props}
        />
    )
}


const ErrorViewContainer = classed<any>('div')`
    rounded
    flex flex-col
    space-y-1 mx-1 p-2
    bg-red-50
`

const ErrorTitle = classed<any>('h1')`
    font-medium
`
const ErrorName = classed<any>('h2')`
    text-red-900
`
const ErrorMessageButton = classed<any>('button')`
    text-left text-sm flex items-center
`
const ErrorStack = classed<any>('pre')`
    ml-3
    text-sm leading-loose
`

interface ErrorViewProps {
    title: string
    error: Error
    children: any
    className?: string
}

export function ErrorView({ title, error, children, className }: ErrorViewProps) {
    const [isExpanded, setIsExpanded] = React.useState<boolean>(false)
    const toggleExpanded = () => setIsExpanded(isExpanded => !isExpanded)

    return (
        <ErrorViewContainer className={className}>
            <ErrorTitle>{title}</ErrorTitle>
            <ErrorName>{error.name}</ErrorName>
            <ErrorMessageButton onClick={toggleExpanded}>
                <FontAwesomeIcon className="mr-2" icon={isExpanded ? solidIcons.faAngleDown : solidIcons.faAngleRight} />
                {error.message}
            </ErrorMessageButton>
            {isExpanded && <ErrorStack>{error.stack}</ErrorStack>}
            {children}
        </ErrorViewContainer>
    )
}


export const Button = classed<any>('button')`
    text-left
    text-slate-800

    hover:bg-gray-200
    focus:bg-gray-300

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

export const IconToggleButton: React.FC<any> = ({ className, isActive, icon, iconDisabled, onUpdate, label="", ...props }) => (
    <Button
        className={(className ?? "") + (isActive ? "" : " text-slate-400")}
        onClick={onUpdate}
        {...props}
    >
        <IconForButton icon={isActive ? icon : (iconDisabled || icon)} />
        {label && <span>{label}</span>}
    </Button>
)

export const IconForButton: React.FC<{ icon: IconDefinition }> = ({ icon }) => (
    <div className="inline-block w-5 text-center">
        <FontAwesomeIcon size="xs" icon={icon} />
    </div>
)



export type LoadFileButtonProps = React.LabelHTMLAttributes<HTMLButtonElement> & {
    onLoad: (file: File) => void
}

export const LoadFileButton = React.forwardRef(
    function LoadFileButton(
        { onLoad, children, ...props }: LoadFileButtonProps,
        ref: React.Ref<HTMLButtonElement>
    ) {
        function loadFile(event) {
            const fileInput = document.createElement('input')
            fileInput.type = 'file'
            fileInput.onchange = () => {
                onLoad(fileInput.files[0])

                // Workaround for headlessui Menu.Item:
                //  Menu.Item seems to inject an onClick handler, which closes the menu.
                //  If the menu is closed, this fileInput doesn't work anymore, so we defer
                //  the handler until the File Dialog is closed.
                props.onClick?.(event)
            }
            fileInput.click()
        }

        return (
            <button ref={ref} {...props} onClick={loadFile}>
                {children}
            </button>
        )
    }
)


export const SaveFileButton: React.FC<any> = ({ mimeType, textContent, filename, children, ...props }) => {
    const dataStr = `data:${mimeType};charset=utf-8,${encodeURIComponent(textContent)}`

    return (
        <a href={dataStr} download={filename} {...props}>
            {children}
        </a>
    )
}

export function saveFile(filename: string, mimeType: string, textContent: string) {
    const blob = new Blob([textContent], { type: mimeType })
    const downloadButton = document.createElement('a')
    downloadButton.href = URL.createObjectURL(blob)
    downloadButton.download = filename
    downloadButton.click()
    downloadButton.remove()
    // setTimeout(() => { downloadButton.remove() })
}