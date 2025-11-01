#!/bin/bash

# Comprehensive Evaluation Export Script
# This script exports all evaluation data: stats, markdown report, and raw JSON

# rmb to chmod +x export_all_evaluation.sh
# start fastapi server - fastapi run main.py
# ./export_all_evaluation.sh

# Configuration
BASE_URL="http://127.0.0.1:8000"
OUTPUT_DIR="evaluation_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SESSION_DIR="${OUTPUT_DIR}/session_${TIMESTAMP}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Evaluation Export Tool (Full)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create output directory
echo -e "${GREEN}Creating session directory: ${SESSION_DIR}${NC}"
mkdir -p "$SESSION_DIR"

# Check if server is running
echo -e "${BLUE}Checking if API server is running...${NC}"
if ! curl -s -f "${BASE_URL}/evaluation/export" > /dev/null 2>&1; then
    echo -e "${RED}Error: API server is not responding${NC}"
    echo -e "${RED}Please make sure the FastAPI server is running:${NC}"
    echo -e "${YELLOW}  fastapi run main.py${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Export 1: Statistics (JSON)
echo -e "${BLUE}[1/3] Exporting statistics...${NC}"
STATS_FILE="${SESSION_DIR}/stats.json"
HTTP_STATUS=$(curl -s -o "$STATS_FILE" -w "%{http_code}" "${BASE_URL}/evaluation/stats")
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ Stats saved to: stats.json${NC}"
else
    echo -e "${RED}✗ Failed to fetch stats (HTTP ${HTTP_STATUS})${NC}"
fi

# Export 2: Markdown Report
echo -e "${BLUE}[2/3] Exporting markdown report...${NC}"
REPORT_FILE="${SESSION_DIR}/evaluation_report.md"
HTTP_STATUS=$(curl -s -o "$REPORT_FILE" -w "%{http_code}" "${BASE_URL}/evaluation/report")
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ Report saved to: evaluation_report.md${NC}"
else
    echo -e "${RED}✗ Failed to fetch report (HTTP ${HTTP_STATUS})${NC}"
fi

# Export 3: Raw JSON Data
echo -e "${BLUE}[3/3] Exporting raw comparison data...${NC}"
RAW_FILE="${SESSION_DIR}/raw_data.json"
HTTP_STATUS=$(curl -s -o "$RAW_FILE" -w "%{http_code}" "${BASE_URL}/evaluation/export")
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ Raw data saved to: raw_data.json${NC}"
else
    echo -e "${RED}✗ Failed to fetch raw data (HTTP ${HTTP_STATUS})${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Export Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "📁 All files saved to: ${YELLOW}${SESSION_DIR}${NC}"
echo ""

# Display summary if jq is available
if command -v jq &> /dev/null && [ -f "$STATS_FILE" ]; then
    echo -e "${BLUE}Quick Summary:${NC}"
    RULE_WINS=$(jq -r '.win_loss_record."rule-based".wins // 0' "$STATS_FILE")
    AGENTIC_WINS=$(jq -r '.win_loss_record.agentic.wins // 0' "$STATS_FILE")
    TOTAL=$(jq -r '.comparisons | length // 0' "$RAW_FILE" 2>/dev/null || echo "0")
    
    echo -e "  📊 Total Comparisons: ${TOTAL}"
    echo -e "  🏆 Rule-based wins: ${RULE_WINS}"
    echo -e "  🤖 Agentic wins: ${AGENTIC_WINS}"
    echo ""
fi

echo -e "${YELLOW}Files generated:${NC}"
echo -e "  📄 stats.json              - Aggregated statistics"
echo -e "  📝 evaluation_report.md    - Academic report (ready for submission)"
echo -e "  💾 raw_data.json           - Complete comparison data"
echo ""
echo -e "${GREEN}✓ Done!${NC}"
