import React from 'react'
import styled from 'styled-components'
import * as headlessui from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'

import * as babelCore from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import * as babelGenerator from '@babel/generator'

import * as repl from './repl'
import * as value from './value'
import * as tables from './tables'
import * as ui from './ui'
import * as utils from './utils'

const library = {
    React,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    styled,
    headlessui,

    babel: {
        core: babelCore,
        react: babelReact,
        parser: babelParser,
        generator: babelGenerator,
    },

    tables,
    ui,
    repl,
    App: value.createApp,
    value,
    utils,
}

export default { stdLibrary: library, ...library }