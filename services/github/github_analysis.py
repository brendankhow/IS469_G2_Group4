import json
from typing import Dict, List, Optional
from services.llm_client import llm_client
from services.vector_store import VectorStore
from utils.json_parser import format_response


class GitHubAnalysisService:
    """
    Comprehensive AI-powered analysis of GitHub portfolios to help students
    better present their work, prepare for interviews, and understand their market value.

    Provides in-depth insights for students including:
    - Project summaries (one-liner, detailed, problem/solution)
    - Technical analysis (architecture, technologies, code quality)
    - Interview preparation (talking points, expected questions)
    - Resume content generation (bullet points, skills, ATS keywords)
    - Portfolio content (taglines, descriptions, demo suggestions)
    - Job fit analysis (suitable roles, industries, experience level)
    - Market relevance (trending tech, hiring demand)
    - Actionable next steps (prioritized improvements)
    """
    
    def __init__(self):
        self.llm = llm_client
    
    def analyze_portfolio_comprehensive(
        self, 
        student_id: str,
        github_username: str,
        analysis_type: str = "full"
    ) -> Dict:
        """
        Perform comprehensive AI analysis of a student's GitHub portfolio.
        
        Args:
            student_id: Student's ID in the system
            github_username: Student's GitHub username
            analysis_type: Type of analysis - "full", "quick", "interview_prep", "resume", "job_fit"
            
        Returns:
            Dictionary containing all analysis results
        """
        # Get portfolio summary from vector store
        portfolio_data = VectorStore.get_student_portfolio_summary(student_id)
        
        if not portfolio_data or portfolio_data.get("total_repos", 0) == 0:
            return {
                "error": "No GitHub portfolio found for this student. Please build portfolio first using /github/create endpoint."
            }
        
        # Enrich portfolio data with actual repository content
        portfolio_data = self._enrich_portfolio_data(student_id, portfolio_data)
        
        # Route to appropriate analysis based on type
        if analysis_type == "full":
            return self._analyze_full_portfolio(portfolio_data, github_username)
        elif analysis_type == "quick":
            return self._analyze_quick_summary(portfolio_data, github_username)
        elif analysis_type == "interview_prep":
            return self._analyze_interview_prep(portfolio_data, github_username)
        elif analysis_type == "resume":
            return self._analyze_resume_content(portfolio_data, github_username)
        elif analysis_type == "job_fit":
            return self._analyze_job_fit(portfolio_data, github_username)
        else:
            return {"error": f"Unknown analysis type: {analysis_type}"}
    
    def _enrich_portfolio_data(self, student_id: str, portfolio_data: Dict) -> Dict:
        """
        Enrich portfolio summary with detailed repository information.
        
        Args:
            student_id: Student's ID
            portfolio_data: Basic portfolio summary
            
        Returns:
            Enriched portfolio data with repository details
        """
        try:
            # Get detailed repository data from github_embeddings table
            from services.supabase_client import supabase
            
            response = supabase.table("github_embeddings") \
                .select("repo_name, text, metadata") \
                .eq("student_id", student_id) \
                .execute()
            
            if response.data:
                # Group by repo_name and aggregate information
                repos_dict = {}
                for item in response.data:
                    repo_name = item.get("repo_name")
                    if repo_name not in repos_dict:
                        metadata = item.get("metadata", {})
                        repos_dict[repo_name] = {
                            "name": repo_name,
                            "description": metadata.get("description", ""),
                            "language": metadata.get("language", ""),
                            "topics": metadata.get("topics", []),
                            "stars": metadata.get("stars", 0),
                            "text_chunks": [],
                            "metadata": metadata
                        }
                    # Add text chunk
                    text = item.get("text", "")
                    if text:
                        repos_dict[repo_name]["text_chunks"].append(text)
                
                # Combine text chunks for each repo
                repositories = []
                for repo_name, repo_data in repos_dict.items():
                    repo_data["full_text"] = "\n\n".join(repo_data["text_chunks"][:3])  # First 3 chunks
                    del repo_data["text_chunks"]  # Remove raw chunks
                    repositories.append(repo_data)
                
                portfolio_data["repositories"] = repositories
                
        except Exception as e:
            print(f"Error enriching portfolio data: {str(e)}")
            # Continue with basic portfolio data
            if "repositories" not in portfolio_data:
                portfolio_data["repositories"] = []
        
        return portfolio_data
    
    def _analyze_full_portfolio(self, portfolio_data: Dict, github_username: str) -> Dict:
        """
        Complete comprehensive analysis covering all aspects.
        """
        system_prompt = """
            You are an expert technical recruiter and career coach specializing in software engineering portfolios.
            You will analyze a student's GitHub portfolio and provide comprehensive, actionable insights.

            Your analysis should be:
            - Honest but encouraging
            - Specific and actionable
            - Industry-aware (mention current hiring trends)
            - Practical (focus on what will help in job search)

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Analyze this GitHub portfolio for {github_username} and provide a comprehensive analysis.

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Provide analysis in the following JSON structure:

            {{
                "executive_summary": {{
                    "one_liner": "Concise one-sentence summary of this developer's profile",
                    "profile_strength": "strong|moderate|developing",
                    "standout_qualities": ["Quality 1", "Quality 2", "Quality 3"],
                    "primary_technical_identity": "e.g., Full-Stack Developer, Data Scientist, Mobile Developer"
                }},
                
                "project_analysis": [
                    {{
                        "repo_name": "Repository name",
                        "one_line_summary": "What this project does in one sentence",
                        "detailed_summary": "2-3 sentences explaining the project, its purpose, and impact",
                        "problem_solved": "What problem does this solve?",
                        "solution_approach": "How does it solve it?",
                        "technical_highlights": ["Tech 1", "Tech 2", "Tech 3"],
                        "code_quality_score": 7,
                        "code_quality_notes": "What makes this code good/improvable",
                        "architecture_notes": "Brief notes on architecture/design patterns used",
                        "complexity_level": "beginner|intermediate|advanced",
                        "portfolio_value": "high|medium|low",
                        "portfolio_value_reason": "Why this project is valuable for portfolio"
                    }}
                ],
                
                "technical_stack_analysis": {{
                    "primary_languages": ["Language 1", "Language 2"],
                    "frameworks_libraries": ["Framework 1", "Framework 2", "Framework 3"],
                    "tools_platforms": ["Tool 1", "Tool 2"],
                    "technical_depth_score": 7,
                    "technical_breadth_score": 6,
                    "trending_technologies": ["Tech that's currently in demand"],
                    "skill_gaps": ["Skills that would complement their stack"],
                    "market_relevance_notes": "How their stack aligns with current job market"
                }},
                
                "interview_preparation": {{
                    "project_talking_points": [
                        {{
                            "project": "Project name",
                            "talking_points": [
                                "Key point 1 to mention in interviews",
                                "Key point 2 to mention in interviews",
                                "Key point 3 to mention in interviews"
                            ]
                        }}
                    ],
                    "expected_questions": [
                        {{
                            "question": "Technical question an interviewer might ask",
                            "suggested_answer_approach": "How to structure the answer",
                            "related_projects": ["Projects to reference in answer"]
                        }}
                    ],
                    "technical_deep_dive_topics": [
                        "Topic 1 to prepare for deep technical discussions",
                        "Topic 2 to prepare for deep technical discussions"
                    ],
                    "behavioral_story_opportunities": [
                        "Challenge/accomplishment story they can tell based on projects"
                    ],
                    "weakness_mitigation": [
                        "How to address potential weak spots in their experience"
                    ]
                }},
                
                "resume_content": {{
                    "professional_summary": "2-3 sentence summary for top of resume",
                    "project_bullet_points": [
                        {{
                            "project": "Project name",
                            "bullets": [
                                "• Action-oriented bullet point 1 (quantify if possible)",
                                "• Action-oriented bullet point 2 (quantify if possible)",
                                "• Action-oriented bullet point 3 (quantify if possible)"
                            ]
                        }}
                    ],
                    "skills_section": {{
                        "languages": ["Language 1", "Language 2"],
                        "frameworks": ["Framework 1", "Framework 2"],
                        "tools": ["Tool 1", "Tool 2"],
                        "concepts": ["Concept 1 (e.g., RESTful APIs, Microservices)"]
                    }},
                    "ats_keywords": [
                        "Keyword 1 that ATS systems look for",
                        "Keyword 2 that ATS systems look for"
                    ],
                    "action_verbs": [
                        "Strong action verb 1 for resume",
                        "Strong action verb 2 for resume"
                    ]
                }},
                
                "portfolio_presentation": {{
                    "github_profile_tagline": "Catchy one-liner for GitHub bio",
                    "linkedin_headline": "Professional headline for LinkedIn",
                    "portfolio_website_intro": "2-3 sentence intro for portfolio website",
                    "project_descriptions": [
                        {{
                            "project": "Project name",
                            "short_description": "One sentence for GitHub repo description",
                            "detailed_description": "2-3 sentences for portfolio website/README",
                            "demo_suggestions": "What to show in a demo or include in screenshots"
                        }}
                    ],
                    "readme_improvement_tips": [
                        "Tip 1 for improving READMEs",
                        "Tip 2 for improving READMEs"
                    ]
                }},
                
                "job_fit_analysis": {{
                    "ideal_roles": [
                        {{
                            "title": "Job title",
                            "fit_score": 8,
                            "reasoning": "Why they're a good fit",
                            "companies_to_target": ["Type of company 1", "Type of company 2"]
                        }}
                    ],
                    "suitable_industries": ["Industry 1", "Industry 2", "Industry 3"],
                    "experience_level": "entry|junior|mid|senior",
                    "salary_range_estimate": "Estimated range based on skills and experience",
                    "competitive_advantages": ["What makes them stand out"],
                    "areas_for_growth": ["What to work on to be more competitive"]
                }},
                
                "market_insights": {{
                    "trending_tech_alignment": {{
                        "aligned": ["Tech they use that's trending"],
                        "not_aligned": ["Trending tech they should learn"]
                    }},
                    "hiring_demand_notes": "Current hiring trends relevant to their profile",
                    "skill_demand_score": 7,
                    "hot_job_markets": ["Geographic/remote markets with demand for their skills"]
                }},
                
                "actionable_next_steps": [
                    {{
                        "priority": "high|medium|low",
                        "action": "Specific action to take",
                        "reasoning": "Why this will help",
                        "estimated_effort": "Time/effort estimate",
                        "expected_impact": "high|medium|low"
                    }}
                ],
                
                "overall_assessment": {{
                    "portfolio_strength_score": 7,
                    "job_readiness_score": 6,
                    "key_strengths": ["Strength 1", "Strength 2", "Strength 3"],
                    "key_opportunities": ["Opportunity 1", "Opportunity 2"],
                    "bottom_line": "Final encouraging and actionable summary"
                }}
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.7
            )
            
            # Parse JSON response
            parsed = format_response(response)
            return parsed
            
        except Exception as e:
            return {
                "error": f"Analysis failed: {str(e)}",
                "raw_response": response if 'response' in locals() else None
            }
    
    def _analyze_quick_summary(self, portfolio_data: Dict, github_username: str) -> Dict:
        """
        Quick 30-second summary of portfolio for fast assessment.
        """
        system_prompt = """
            You are an expert technical recruiter doing a quick portfolio review.
            Provide a fast, actionable summary that can be read in 30 seconds.

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Quick review of {github_username}'s GitHub portfolio:

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Return JSON:
            {{
                "quick_summary": "2-3 sentence overview",
                "technical_identity": "What kind of developer they are",
                "standout_projects": ["Project 1", "Project 2"],
                "key_skills": ["Skill 1", "Skill 2", "Skill 3"],
                "job_readiness": "ready|nearly_ready|needs_work",
                "one_thing_to_improve": "Single most impactful improvement"
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.5
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Quick analysis failed: {str(e)}"}
    
    def _analyze_interview_prep(self, portfolio_data: Dict, github_username: str) -> Dict:
        """
        Focused interview preparation analysis.
        """
        system_prompt = """
            You are an interview coach helping a student prepare to discuss their GitHub portfolio.
            Focus on practical talking points, likely questions, and strong answers.

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
                    
        user_prompt = f"""
            Help {github_username} prepare for technical interviews based on their GitHub portfolio:

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Return JSON:
            {{
                "elevator_pitch": "30-second introduction about their technical background",
                "project_talking_points": [
                    {{
                        "project": "Project name",
                        "what_to_say": "Key points to mention",
                        "technical_details_to_highlight": ["Detail 1", "Detail 2"],
                        "challenges_overcome": "Good story about problem-solving"
                    }}
                ],
                "likely_questions": [
                    {{
                        "question": "Question interviewer might ask",
                        "how_to_answer": "Suggested answer structure",
                        "projects_to_reference": ["Relevant project"]
                    }}
                ],
                "technical_discussion_prep": [
                    {{
                        "topic": "Technical topic",
                        "what_you_know": "What they can confidently discuss",
                        "what_to_study": "Quick refresher points"
                    }}
                ],
                "behavioral_stories": [
                    "Story 1 about challenge/success based on projects",
                    "Story 2 about challenge/success based on projects"
                ],
                "questions_to_ask_interviewer": [
                    "Smart question 1 they can ask",
                    "Smart question 2 they can ask"
                ]
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Interview prep analysis failed: {str(e)}"}
    
    def _analyze_resume_content(self, portfolio_data: Dict, github_username: str) -> Dict:
        """
        Generate resume-ready content from GitHub portfolio.
        """
        system_prompt = """
            You are a professional resume writer specializing in technical resumes.
            Convert GitHub portfolio data into strong, ATS-friendly resume content.

            Focus on:
            - Action verbs
            - Quantifiable achievements
            - Impact and results
            - Keywords for ATS
            - Industry-standard phrasing

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Create resume content for {github_username} based on their GitHub portfolio:

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Return JSON:
            {{
                "professional_summary": "2-3 sentence summary for top of resume",
                "technical_skills": {{
                    "programming_languages": ["Language 1", "Language 2"],
                    "frameworks_libraries": ["Framework 1", "Framework 2"],
                    "tools_platforms": ["Tool 1", "Tool 2"],
                    "databases": ["Database 1", "Database 2"],
                    "concepts": ["REST APIs", "Agile", "etc"]
                }},
                "project_experience": [
                    {{
                        "project_title": "Project name or title",
                        "role": "Developer/Creator/Contributor",
                        "date": "Approximate timeframe if determinable",
                        "bullet_points": [
                            "• Developed/Built/Created [what] using [technologies] resulting in [impact]",
                            "• Implemented [feature] to [solve problem] improving [metric] by [amount]",
                            "• Designed and architected [component] utilizing [tech] for [purpose]"
                        ],
                        "technologies_used": ["Tech 1", "Tech 2"]
                    }}
                ],
                "ats_keywords": [
                    "Important keyword 1",
                    "Important keyword 2",
                    "Important keyword 3"
                ],
                "suggested_action_verbs": [
                    "Architected", "Engineered", "Optimized", "Implemented", "etc"
                ],
                "achievement_metrics": [
                    "Suggestion for quantifying achievement 1",
                    "Suggestion for quantifying achievement 2"
                ]
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.5
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Resume content generation failed: {str(e)}"}
    
    def _analyze_job_fit(self, portfolio_data: Dict, github_username: str) -> Dict:
        """
        Analyze what jobs/roles the student is qualified for.
        """
        system_prompt = """
            You are a technical recruiter analyzing job fit based on a candidate's GitHub portfolio.
            Be realistic about their current level while identifying growth opportunities.

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Analyze job fit for {github_username} based on their GitHub portfolio:

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Return JSON:
            {{
                "current_level_assessment": {{
                    "experience_level": "entry|junior|mid|senior",
                    "years_equivalent": "Estimated years of equivalent experience",
                    "reasoning": "Why this level assessment"
                }},
                "ideal_job_titles": [
                    {{
                        "title": "Job title",
                        "fit_score": 8,
                        "match_strengths": ["Why they fit"],
                        "skill_gaps": ["What they might need to learn on the job"],
                        "example_companies": ["Type of company hiring for this"]
                    }}
                ],
                "stretch_roles": [
                    {{
                        "title": "Slightly above current level",
                        "what_to_strengthen": ["Skills to work on"],
                        "timeline": "How long to prepare"
                    }}
                ],
                "industries_to_target": [
                    {{
                        "industry": "Industry name",
                        "why_good_fit": "Reasoning",
                        "example_companies": ["Company 1", "Company 2"]
                    }}
                ],
                "company_size_fit": {{
                    "startup": "good|okay|not_ideal + reasoning",
                    "mid_size": "good|okay|not_ideal + reasoning",
                    "enterprise": "good|okay|not_ideal + reasoning"
                }},
                "salary_expectations": {{
                    "estimated_range": "Range based on skills and market",
                    "factors": ["What influences this estimate"],
                    "growth_potential": "How much growth in 1-2 years"
                }},
                "competitive_positioning": {{
                    "strong_differentiators": ["What makes them stand out"],
                    "common_gaps": ["What many candidates at this level lack"],
                    "unique_value_proposition": "What makes them special"
                }},
                "job_search_strategy": [
                    "Strategy tip 1",
                    "Strategy tip 2",
                    "Strategy tip 3"
                ]
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Job fit analysis failed: {str(e)}"}
    
    def analyze_single_project_deep_dive(
        self,
        student_id: str,
        repo_name: str,
        analysis_focus: str = "all"
    ) -> Dict:
        """
        Deep dive analysis of a single project.
        
        Args:
            student_id: Student's ID
            repo_name: Specific repository name
            analysis_focus: "all", "technical", "presentation", "interview"
            
        Returns:
            Detailed analysis of single project
        """
        # Get portfolio data
        portfolio_data = VectorStore.get_student_portfolio_summary(student_id)
        
        if not portfolio_data or portfolio_data.get("total_repos", 0) == 0:
            return {"error": "Portfolio not found. Please build portfolio first using /github/create endpoint."}
        
        # Enrich with repository details
        portfolio_data = self._enrich_portfolio_data(student_id, portfolio_data)
        
        # Filter to specific repo
        repo_data = None
        for repo in portfolio_data.get("repositories", []):
            if repo.get("name") == repo_name:
                repo_data = repo
                break
        
        if not repo_data:
            available_repos = [r.get("name") for r in portfolio_data.get("repositories", [])]
            return {
                "error": f"Repository '{repo_name}' not found in portfolio. Available repositories: {', '.join(available_repos)}"
            }
        
        system_prompt = """
            You are a senior software engineer conducting a detailed code review and portfolio assessment.
            Provide in-depth, technical analysis that will help the student improve and present this project better.

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Provide a deep-dive analysis of this GitHub project:

            **Project Data:**
            {json.dumps(repo_data, indent=2)}

            Focus: {analysis_focus}

            Return JSON:
            {{
                "project_overview": {{
                    "one_liner": "What this project does",
                    "detailed_summary": "Comprehensive explanation",
                    "problem_statement": "What problem it solves",
                    "solution_approach": "How it solves it",
                    "target_users": "Who would use this",
                    "real_world_application": "How this could be used in production"
                }},
                "technical_deep_dive": {{
                    "architecture": "High-level architecture explanation",
                    "design_patterns": ["Pattern 1", "Pattern 2"],
                    "technology_choices": [
                        {{
                            "technology": "Tech name",
                            "why_good_choice": "Reasoning",
                            "alternatives": ["Alternative tech"]
                        }}
                    ],
                    "code_quality_assessment": {{
                        "score": 7,
                        "strengths": ["Strength 1", "Strength 2"],
                        "areas_for_improvement": ["Improvement 1", "Improvement 2"]
                    }},
                    "scalability_analysis": "How well this would scale",
                    "security_considerations": "Security aspects observed or needed",
                    "testing_coverage": "Assessment of testing (if visible)",
                    "complexity_rating": "beginner|intermediate|advanced"
                }},
                "interview_discussion_guide": {{
                    "elevator_pitch": "30-second explanation of this project",
                    "key_talking_points": [
                        "Point 1: What to emphasize",
                        "Point 2: What to emphasize"
                    ],
                    "technical_questions_to_expect": [
                        {{
                            "question": "Question interviewer might ask",
                            "suggested_answer": "How to answer effectively"
                        }}
                    ],
                    "challenges_to_discuss": [
                        {{
                            "challenge": "Technical challenge faced",
                            "solution": "How you solved it",
                            "learning": "What you learned"
                        }}
                    ],
                    "advanced_discussion_topics": [
                        "Topic 1 for senior interviewers",
                        "Topic 2 for senior interviewers"
                    ]
                }},
                "presentation_improvements": {{
                    "readme_assessment": {{
                        "current_quality": "good|okay|needs_work",
                        "missing_elements": ["Element 1", "Element 2"],
                        "suggested_structure": ["Section 1", "Section 2", "Section 3"]
                    }},
                    "suggested_readme_content": {{
                        "title_and_tagline": "Catchy project title and one-liner",
                        "description": "1-2 paragraph description",
                        "key_features": ["Feature 1", "Feature 2"],
                        "tech_stack_presentation": "How to present the technologies used",
                        "installation_section": "What to include",
                        "usage_examples": "What examples to show",
                        "screenshots_needed": ["What to capture 1", "What to capture 2"]
                    }},
                    "demo_recommendations": {{
                        "what_to_show": ["Feature 1 to demo", "Feature 2 to demo"],
                        "demo_flow": "Suggested order for demonstration",
                        "talking_points_during_demo": ["Point 1", "Point 2"]
                    }},
                    "github_repo_settings": {{
                        "description": "Suggested GitHub repo description",
                        "topics": ["topic1", "topic2", "topic3"],
                        "website_link": "Suggestion for homepage link"
                    }}
                }},
                "enhancement_suggestions": [
                    {{
                        "priority": "high|medium|low",
                        "suggestion": "What to add/improve",
                        "impact": "How this helps",
                        "effort": "low|medium|high",
                        "implementation_hints": "How to implement"
                    }}
                ],
                "portfolio_value": {{
                    "current_score": 7,
                    "value_for_job_search": "high|medium|low",
                    "best_used_for": ["Interview discussion", "Resume inclusion", "etc"],
                    "roles_this_demonstrates_fit_for": ["Role 1", "Role 2"]
                }}
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Project analysis failed: {str(e)}"}
    
    def generate_portfolio_comparison(
        self,
        student_id: str,
        target_role: str
    ) -> Dict:
        """
        Compare student's portfolio against typical requirements for a target role.
        
        Args:
            student_id: Student's ID
            target_role: Target job title (e.g., "Frontend Developer", "Data Scientist")
            
        Returns:
            Gap analysis and recommendations
        """
        portfolio_data = VectorStore.get_student_portfolio_summary(student_id)
        
        if not portfolio_data or portfolio_data.get("total_repos", 0) == 0:
            return {"error": "Portfolio not found. Please build portfolio first using /github/create endpoint."}
        
        # Enrich with repository details
        portfolio_data = self._enrich_portfolio_data(student_id, portfolio_data)
        
        system_prompt = """
            You are a technical hiring manager who knows exactly what skills and experience
            are needed for different roles. Provide honest gap analysis and specific recommendations.

            **CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.**
            """
        
        user_prompt = f"""
            Compare this portfolio against requirements for a {target_role} role:

            **Portfolio Data:**
            {json.dumps(portfolio_data, indent=2)}

            Return JSON:
            {{
                "role_requirements": {{
                    "must_have_skills": ["Skill 1", "Skill 2"],
                    "nice_to_have_skills": ["Skill 3", "Skill 4"],
                    "typical_projects": ["Project type 1", "Project type 2"]
                }},
                "gap_analysis": {{
                    "has": ["What they have that matches"],
                    "missing_critical": ["Critical gaps"],
                    "missing_nice_to_have": ["Nice-to-have gaps"],
                    "overall_fit_score": 7
                }},
                "projects_that_demonstrate_fit": [
                    {{
                        "project": "Project name",
                        "relevant_skills": ["Skill 1", "Skill 2"],
                        "how_to_present": "How to frame this for the target role"
                    }}
                ],
                "skill_building_roadmap": [
                    {{
                        "priority": "high|medium|low",
                        "skill": "Skill to learn",
                        "why_important": "Why needed for this role",
                        "how_to_learn": "Learning suggestion",
                        "project_idea": "Project to build to demonstrate this skill",
                        "timeline": "Estimated time to learn"
                    }}
                ],
                "current_competitiveness": {{
                    "rating": "highly_competitive|competitive|needs_improvement",
                    "reasoning": "Explanation",
                    "percentile_estimate": "Estimated percentile among applicants"
                }},
                "application_strategy": {{
                    "should_apply_now": "yes|with_caveats|not_yet",
                    "reasoning": "Why or why not",
                    "how_to_position_yourself": "Application strategy",
                    "resume_focus": ["What to emphasize 1", "What to emphasize 2"],
                    "interview_preparation_focus": ["What to prepare 1", "What to prepare 2"]
                }}
            }}
            """
        
        try:
            response = self.llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6
            )
            return format_response(response)
        except Exception as e:
            return {"error": f"Comparison analysis failed: {str(e)}"}


# Singleton instance
github_analysis_service = GitHubAnalysisService()
