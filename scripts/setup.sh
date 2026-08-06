#!/bin/bash

# ==============================================================================
# GalibierHub Local Setup Script
# ==============================================================================
# This script automates the initial setup for local development or HPC deployment.
# It checks prerequisites, creates the .env.local file, and installs dependencies.
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       Welcome to GalibierHub Local Setup              ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

echo -e "${YELLOW}[1/4] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js v18 or later from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js v18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) detected${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ npm $(npm -v) detected${NC}"

echo ""
echo -e "${YELLOW}[2/4] Setting up environment variables...${NC}"

if [ ! -f .env.local ]; then
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        echo -e "${GREEN}  ✓ Created .env.local from .env.local.example${NC}"
        echo -e "${YELLOW}  ⚠  Please edit .env.local and fill in your API keys before running the app.${NC}"
    else
        echo -e "${RED}Error: .env.local.example not found.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}  ℹ  .env.local already exists, skipping.${NC}"
fi

echo ""
echo -e "${YELLOW}[3/4] Installing npm dependencies...${NC}"
echo "This may take a few minutes..."

npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: npm install failed. Please check the error logs above.${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

echo ""
echo -e "${YELLOW}[4/4] Verifying build...${NC}"

if npm run build 2>/dev/null; then
    echo -e "${GREEN}  ✓ Build successful${NC}"
else
    echo -e "${YELLOW}  ⚠  Build failed (this is expected if .env.local is not fully configured).${NC}"
    echo -e "${YELLOW}     Fill in your API keys in .env.local and run 'npm run build' manually.${NC}"
fi

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}   Setup Complete!                                     ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your Supabase, Hugging Face, and other API keys"
echo "  2. Run 'npm run dev' to start the local development server"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "For production deployment:"
echo "  - Cloudflare Pages: Click the deploy button in README.md"
echo "  - Vercel:           Run 'npm run build && npm run start'"
echo ""
