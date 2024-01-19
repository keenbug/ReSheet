import 'react'

declare module 'react' {
    interface CSSProperties {
        // allow css vars in inline style parameters
        [key: `--${string}`]: string | number
    }
}