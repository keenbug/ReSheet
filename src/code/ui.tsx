import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

interface ErrorViewProps {
    title: string
    error: Error
    children: any
    className?: string
}

export function ErrorView({ title, error, children, className }: ErrorViewProps) {
    const [isExpanded, setExpanded] = React.useState(false)
    const [isStackVisible, setStackVisible] = React.useState<boolean>(false)
    const toggleStackVisible = () => setStackVisible(isExpanded => !isExpanded)

    return (
        <div className={`bg-red-50 px-1 flex flex-col space-y-1 ${className}`}>
            <button
                className="w-full text-red-900 flex flex-row justify-start items-baseline space-x-1"
                onClick={() => setExpanded(e => !e)}
            >
                <span className="flex-1 text-left truncate">
                    <FontAwesomeIcon className="text-red-400" icon={solidIcons.faTriangleExclamation} /> {}
                    <span className="font-medium">{error.name}:</span> {error.message}
                </span>
                <span>
                    <FontAwesomeIcon icon={isExpanded ? solidIcons.faAngleUp : solidIcons.faAngleDown} />
                </span>
            </button>
            {isExpanded && <>
                <div className="font-medium">{title}</div>
                <div className="text-red-950">{error.name}</div>
                <button
                    className="text-left text-sm flex items-baseline"
                    onClick={toggleStackVisible}
                >
                    <FontAwesomeIcon className="mr-2" icon={isStackVisible ? solidIcons.faAngleDown : solidIcons.faAngleRight} size="sm" />
                    <span>{error.message}</span>
                </button>
                {isStackVisible && <pre className="ml-3 text-sm leading-loose">{error.stack}</pre>}
                {children}
            </>}
        </div>
    )
}
