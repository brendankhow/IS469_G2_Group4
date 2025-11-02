#!/bin/bash

# Router Comparison Export Script
# This script runs router comparisons and saves results - just runs once only 
# runs the /chat/compare-routers endpoint and saves output to JSON - don't need to run in swagger 

# Configuration
BASE_URL="http://127.0.0.1:8000"
OUTPUT_DIR="router_comparison_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SESSION_DIR="${OUTPUT_DIR}/session_${TIMESTAMP}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🔬 Router Comparison Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create output directory
echo -e "${GREEN}Creating session directory: ${SESSION_DIR}${NC}"
mkdir -p "$SESSION_DIR"

# Check if server is running
echo -e "${BLUE}Checking if API server is running...${NC}"
if ! curl -s -f "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${RED}Error: API server is not responding${NC}"
    echo -e "${RED}Please make sure the FastAPI server is running:${NC}"
    echo -e "${YELLOW}  fastapi run main.py${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Check if Ollama is running (required for Llama router)
echo -e "${BLUE}Checking if Ollama is running...${NC}"
if ! curl -s -f "http://localhost:11434/api/tags" > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Warning: Ollama is not running${NC}"
    echo -e "${YELLOW}   Llama3.2:1B router requires Ollama${NC}"
    echo -e "${YELLOW}   Start Ollama or comparison will fail${NC}"
    echo ""
fi

# Query to test (you can modify this)
QUERY=${1:-"I'm looking for a software engineer with experience in frontend tech like typescript and javascript."}
MIN_CANDIDATES=${2:-1}
MIN_FIT_SCORE=${3:-5.0}
MAX_ITERATIONS=${4:-5}

echo -e "Query: ${YELLOW}${QUERY}${NC}"
echo -e "Min Candidates: ${YELLOW}${MIN_CANDIDATES}${NC}"
echo -e "Min Fit Score: ${YELLOW}${MIN_FIT_SCORE}${NC}"
echo -e "Max Iterations: ${YELLOW}${MAX_ITERATIONS}${NC}"
echo ""

# Run router comparison
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Running Router Comparison${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${PURPLE}🤖 DeepSeek-V3 (Frontier Model)${NC} vs ${PURPLE}🦙 Llama3.2:1B (Local Model)${NC}"
echo ""

COMPARISON_FILE="${SESSION_DIR}/router_comparison.json"
RESPONSE=$(curl -s -X POST "${BASE_URL}/chat/compare-routers" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"${QUERY}\",
    \"min_candidates\": ${MIN_CANDIDATES},
    \"min_fit_score\": ${MIN_FIT_SCORE},
    \"max_iterations\": ${MAX_ITERATIONS},
    \"temperature\": 0.7
  }")

# Save comparison result
echo "$RESPONSE" | jq '.' > "$COMPARISON_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Router comparison saved to: router_comparison.json${NC}"
else
    # If jq is not installed, save without formatting
    echo "$RESPONSE" > "$COMPARISON_FILE"
    echo -e "${GREEN}✓ Router comparison saved to: router_comparison.json${NC}"
    echo -e "${YELLOW}  (Install 'jq' for formatted JSON output: brew install jq)${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Comparison Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "📁 Results saved to: ${YELLOW}${SESSION_DIR}${NC}"
echo ""

# Display summary if jq is available
if command -v jq &> /dev/null && [ -f "$COMPARISON_FILE" ]; then
    echo -e "${BLUE}📊 Summary:${NC}"
    
    WINNER=$(echo "$RESPONSE" | jq -r '.winner // "N/A"')
    REASON=$(echo "$RESPONSE" | jq -r '.winner_reason // "N/A"')
    
    # DeepSeek stats
    DS_TIME=$(echo "$RESPONSE" | jq -r '.deepseek_result.execution_time // 0')
    DS_COST=$(echo "$RESPONSE" | jq -r '.deepseek_result.estimated_cost // 0')
    DS_CANDIDATES=$(echo "$RESPONSE" | jq -r '.deepseek_result.candidates_found // 0')
    DS_SCORE=$(echo "$RESPONSE" | jq -r '.deepseek_result.top_candidate_score // 0')
    DS_GOAL=$(echo "$RESPONSE" | jq -r '.deepseek_result.goal_achieved')
    
    # Llama stats
    LM_TIME=$(echo "$RESPONSE" | jq -r '.llama_result.execution_time // 0')
    LM_COST=$(echo "$RESPONSE" | jq -r '.llama_result.estimated_cost // 0')
    LM_CANDIDATES=$(echo "$RESPONSE" | jq -r '.llama_result.candidates_found // 0')
    LM_SCORE=$(echo "$RESPONSE" | jq -r '.llama_result.top_candidate_score // 0')
    LM_GOAL=$(echo "$RESPONSE" | jq -r '.llama_result.goal_achieved')
    
    echo ""
    echo -e "${PURPLE}🤖 DeepSeek-V3 (Frontier):${NC}"
    echo -e "   Time: ${DS_TIME}s | Cost: \$${DS_COST} | Candidates: ${DS_CANDIDATES} | Score: ${DS_SCORE} | Goal: ${DS_GOAL}"
    echo ""
    echo -e "${PURPLE}🦙 Llama3.2:1B (Local):${NC}"
    echo -e "   Time: ${LM_TIME}s | Cost: \$${LM_COST} | Candidates: ${LM_CANDIDATES} | Score: ${LM_SCORE} | Goal: ${LM_GOAL}"
    echo ""
    echo -e "${GREEN}🏆 Winner: ${WINNER}${NC}"
    echo -e "   ${REASON}"
    echo ""
fi

echo -e "${YELLOW}Files generated:${NC}"
echo -e "  📄 router_comparison.json  - Full comparison results"
echo ""
echo -e "${GREEN}✓ Done!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • View results: ${YELLOW}cat ${COMPARISON_FILE} | jq .${NC}"
echo -e "  • Run again with different query: ${YELLOW}./export_router_comparison.sh \"your query here\"${NC}"
echo ""
