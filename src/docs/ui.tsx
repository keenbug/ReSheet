import Markdown from 'markdown-to-jsx'
import styled from "styled-components"

export const DocMarkdown = styled(Markdown)`
    font-size: 0.75rem;


    /* Headers */

    & h1 {
        font-weight: 500;
        font-size: 1.25rem;
        margin-bottom: 0.375rem;
    }

    & h2 {
        font-weight: 500;
        font-size: 1rem;
        margin-top: 0.75rem;
        margin-bottom: 0.25rem;
    }

    & h3 {
        font-weight: 500;
        font-size: 0.875rem;
        margin-top: 0.75rem;
        margin-bottom: 0.25rem;
    }

    & h4 {
        font-weight: 500;
        font-size: 0.75rem;
        margin-top: 0.5rem;
        margin-bottom: 0.25rem;
    }

    & h5 {
        font-weight: 500;
        font-size: 0.75rem;
        margin-top: 0.5rem;
        margin-bottom: 0.25rem;
    }

    & h6 {
        font-weight: 500;
        font-size: 0.75rem;
        margin-top: 0.5rem;
        margin-bottom: 0.25rem;
    }


    /* Paragraphs */

    & p + p {
        margin: 0.625rem 0;
    }


    /* Lists */

    & ul ul {
        padding-inline-start: 1rem;
    }

    & li + li {
        margin-top: 0.5rem;
    }


    /* Tables */

    & table {
        margin: 1rem 0;
        overflow-x: auto;
    }

    & td,
    & th {
        text-align: start;
        padding: 0.25rem 0.5rem;
    }

    & th {
        background-color: rgb(243 244 246); /* gray-100 */
        font-weight: bold;
    }

    & tr:nth-child(even) {
        background-color: rgb(243 244 246); /* gray-100 */
    }


    /* Links */

    a {
        color: rgb(30 64 175); /* blue-800 */
    }
`
