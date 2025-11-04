#!/bin/bash

# Export Evaluation Results Script
# This script fetches evaluation data from the API and saves it to a JSON file

# Configuration
API_URL="http://127.0.0.1:8000/evaluation/export"
OUTPUT_DIR="evaluation_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="${OUTPUT_DIR}/evaluation_export_${TIMESTAMP}.json"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Evaluation Results Export Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create output directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
    echo -e "${GREEN}Creating output directory: ${OUTPUT_DIR}${NC}"
    mkdir -p "$OUTPUT_DIR"
fi

# Check if server is running
echo -e "${BLUE}Checking if API server is running...${NC}"
if ! curl -s -f "${API_URL}" > /dev/null 2>&1; then
    echo -e "${RED}Error: API server is not responding at ${API_URL}${NC}"
    echo -e "${RED}Please make sure the FastAPI server is running (fastapi run main.py)${NC}"
    exit 1
fi

# Fetch evaluation data
echo -e "${GREEN}Fetching evaluation data from API...${NC}"
HTTP_STATUS=$(curl -s -o "$OUTPUT_FILE" -w "%{http_code}" "$API_URL")

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ Successfully exported evaluation results!${NC}"
    echo -e "${GREEN}✓ File saved to: ${OUTPUT_FILE}${NC}"
    echo ""
    
    # Display summary
    echo -e "${BLUE}Summary:${NC}"
    if command -v jq &> /dev/null; then
        # If jq is installed, show formatted summary
        TOTAL_COMPARISONS=$(jq '.comparisons | length' "$OUTPUT_FILE")
        echo -e "  Total comparisons: ${TOTAL_COMPARISONS}"
        echo -e "  File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    else
        # If jq is not installed, just show file size
        echo -e "  File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
        echo -e "  ${BLUE}(Install 'jq' for detailed summary: brew install jq)${NC}"
    fi
    echo ""
    echo -e "${GREEN}Done!${NC}"
else
    echo -e "${RED}Error: Failed to fetch data (HTTP ${HTTP_STATUS})${NC}"
    rm -f "$OUTPUT_FILE"
    exit 1
fi
