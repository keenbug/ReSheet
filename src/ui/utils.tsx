import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { css } from 'styled-components'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { interpolate } from '../utils'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'


// Fulfilled by both React.KeyboardEvent and the DOM's KeyboardEvent
interface KeyboardEvent {
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    key: string
}

export function getFullKey(event: KeyboardEvent) {
    return [
        (event.ctrlKey || event.metaKey) ? "C-" : "",
        event.shiftKey ? "Shift-" : "",
        event.altKey ? "Alt-" : "",
        event.key.length > 1 ? event.key : event.key.toUpperCase(),
    ].join('')
}


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


export function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    if (!element) { return null }

    const isScrollable = element.scrollHeight > element.clientHeight
    if (isScrollable) { return element }

    return findScrollableAncestor(element.parentElement)
}



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

export const TextInput: React.FC<any> = React.forwardRef(
    function TextInput({ value, onUpdate, ...props }, ref) {
        const textInputRef = React.useRef(null)
        React.useImperativeHandle(ref, () => textInputRef.current)
        React.useLayoutEffect(() => {
            if (fixedWidthToSpace(textInputRef.current.textContent) !== fixedWidthToSpace(value)) {
                textInputRef.current.textContent = fixedWidthToSpace(value)
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
                ref={textInputRef}
                onInput={onInput}
                spellCheck={false}
                {...props}
            />
        )
    }
)


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


export function selectFile(): Promise<File> {
    return new Promise(resolve => {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.onchange = () => {
            resolve(fileInput.files[0])
            fileInput.remove()
        }
        fileInput.click()
    })
}


export interface LoadFileButtonProps extends Omit<React.LabelHTMLAttributes<HTMLButtonElement>, 'onLoad'> {
    onLoad: (file: File) => void
}

export const LoadFileButton = React.forwardRef(
    function LoadFileButton(
        { onLoad, children, ...props }: LoadFileButtonProps,
        ref: React.Ref<HTMLButtonElement>
    ) {
        async function loadFile(event) {
            onLoad(await selectFile())

            // Workaround for headlessui Menu.Item:
            //  Menu.Item seems to inject an onClick handler, which closes the menu.
            //  If the menu is closed, this fileInput doesn't work anymore, so we defer
            //  the handler until the File Dialog is closed.
            props.onClick?.(event)
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
}