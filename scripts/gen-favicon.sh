#!/bin/bash

# imagemagick has to be installed
convert "$1" -define icon:auto-resize=64,48,32,16 favicon.ico