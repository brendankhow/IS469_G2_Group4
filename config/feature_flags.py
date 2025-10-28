class FeatureFlags:
    """Feature flags for different RAG implementations or any other feature toggles."""
    
    # Enable/disable specific RAG implementation
    # if both false it will fallback to use the original one 
    ENABLE_CUSTOM_RAG: bool = True
    ENABLE_GRAPH_RAG: bool = False

    # for github analysis - check if github username is available or smth 
    ENABLE_GITHUB_ANALYSIS: bool = True 

# Singleton instance
feature_flags = FeatureFlags()