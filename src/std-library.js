import React from 'react'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'

import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'

import * as repl from './repl'
import * as value from './value'
import * as tables from './tables'
import * as ui from './ui'
import * as utils from './utils'

export default {
    React,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    styled,

    babel,
    babelReact,
    babelParser,

    tables,
    ui,
    repl,
    App: value.createApp,
    value,
    utils,
}