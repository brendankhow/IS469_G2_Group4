import json
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

# Load evaluation data
eval_dir = Path("evaluation_results")
latest_session = max(eval_dir.glob("session_*"))
with open(latest_session / "raw_data.json") as f:
    data = json.load(f)

# Extract metrics
rule_times = [c["rule_based"]["execution_time"] for c in data["comparisons"]]
agentic_times = [c["agentic"]["execution_time"] for c in data["comparisons"]]
rule_costs = [c["rule_based"]["estimated_cost"] for c in data["comparisons"]]
agentic_costs = [c["agentic"]["estimated_cost"] for c in data["comparisons"]]

# Create comparison chart
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# Speed comparison
axes[0].bar(["Rule-Based", "Agentic"], 
           [np.mean(rule_times), np.mean(agentic_times)],
           color=["#2ecc71", "#e74c3c"])
axes[0].set_ylabel("Execution Time (s)")
axes[0].set_title("Speed Comparison")
axes[0].grid(axis='y', alpha=0.3)

# Cost comparison
axes[1].bar(["Rule-Based", "Agentic"], 
           [np.mean(rule_costs), np.mean(agentic_costs)],
           color=["#2ecc71", "#e74c3c"])
axes[1].set_ylabel("Cost ($)")
axes[1].set_title("Cost Comparison")
axes[1].grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig("evaluation_results/comparison_chart.png", dpi=300)
print("✓ Chart saved to evaluation_results/comparison_chart.png")