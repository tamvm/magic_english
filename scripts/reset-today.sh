#!/bin/bash

# Reset Today's Learning - Magic English
# Simple wrapper script for the Node.js reset script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/reset-today-learning.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Magic English - Reset Today's Learning${NC}"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    echo "Please install Node.js to run this script"
    exit 1
fi

# Check if the Node.js script exists
if [ ! -f "$NODE_SCRIPT" ]; then
    echo -e "${RED}❌ Error: reset-today-learning.js not found${NC}"
    echo "Expected location: $NODE_SCRIPT"
    exit 1
fi

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    node "$NODE_SCRIPT" --help
    exit 0
fi

# Warn user about the action
echo -e "${YELLOW}⚠️  WARNING: This will reset ALL cards studied today to their previous state${NC}"
echo -e "${YELLOW}   This action cannot be undone!${NC}"
echo

# If --dry-run is passed, just run it
if [[ "$*" == *"--dry-run"* ]]; then
    echo -e "${BLUE}🔍 Running in dry-run mode...${NC}"
    echo
    node "$NODE_SCRIPT" "$@"
    exit $?
fi

# Otherwise, ask for confirmation
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Reset cancelled${NC}"
    exit 0
fi

echo
echo -e "${GREEN}🚀 Starting reset process...${NC}"
echo

# Run the Node.js script
node "$NODE_SCRIPT" "$@"

# Check exit code
if [ $? -eq 0 ]; then
    echo
    echo -e "${GREEN}✅ Reset completed successfully!${NC}"
else
    echo
    echo -e "${RED}❌ Reset failed. Check the error messages above.${NC}"
    exit 1
fi