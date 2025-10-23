"""
Quick test to verify the type mismatch fix works
"""

import sys
sys.path.append('/Users/riannelim/Documents/GitHub/IS469_G2_Group4')

from services.vector_store import VectorStore

# Test with the student ID from your example
STUDENT_ID = "dd5b35f8-2262-42bc-954e-8131afd6e367"

print("Testing VectorStore.get_student_portfolio_summary()...")
print("=" * 60)

try:
    result = VectorStore.get_student_portfolio_summary(STUDENT_ID)
    print("✅ SUCCESS!")
    print("\nReturned data:")
    print(f"  Student Name: {result.get('student_name')}")
    print(f"  GitHub Username: {result.get('github_username')}")
    print(f"  Total Repos: {result.get('total_repos')}")
    print(f"  Total Resume Chunks: {result.get('total_resume_chunks')}")
    print(f"  Top Languages: {result.get('top_languages')}")
    print(f"  Total Stars: {result.get('total_stars')}")
    
    # Check if repositories are included
    repos = result.get('repositories', [])
    if repos:
        print(f"\n  Repositories found: {len(repos)}")
        if isinstance(repos[0], dict):
            print(f"  First repo: {repos[0].get('name', 'Unknown')}")
        else:
            print(f"  First repo: {repos[0]}")
    else:
        print("\n  No repositories in response (this is OK for basic summary)")
    
    print("\n" + "=" * 60)
    print("Test PASSED! The type mismatch issue is fixed.")
    
except Exception as e:
    print(f"❌ FAILED: {str(e)}")
    import traceback
    traceback.print_exc()
