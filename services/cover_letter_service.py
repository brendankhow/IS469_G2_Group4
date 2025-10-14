# services/resume_feedback_service.py
from services.supabase_client import supabase
from services.llm_client import llm_client
from typing import List, Dict

class coverLetterService:
    @staticmethod
    def generate_resume_feedback(resume_text: str) -> str:
        system_prompt = """
        You are a world-class career coach providing feedback on a student's resume. 
        Your tone is encouraging but direct. Identify 3 strengths and 3 areas for 
        improvement, providing specific, actionable advice for each. Format your 
        response in clear markdown sections. Keep your response short and concise.
        """
        
        feedback = llm_client.generate_text(system_prompt, resume_text)
        return feedback
    
    @staticmethod
    def generate_cover_letter_for_job(job_description: str, relevant_experience_chunks: List[str]) -> str:
        """
        Generates a tailored cover letter using a JD and relevant resume snippets.
        """
        print("LLM Service: Generating cover letter...")

        context = "\n- ".join(relevant_experience_chunks)
        
        system_prompt = """
        You are a professional career writer crafting a compelling, concise, and professional cover letter for a student. 
        You MUST seamlessly weave the candidate's most relevant experiences into a narrative. 
        Do not just list their skills; connect them to the job's requirements and tell a story.
        """
        
        user_prompt = f"""
        Here is the job description the student is applying for:
        --- JOB DESCRIPTION ---
        {job_description}
        --- END JOB DESCRIPTION ---

        Here are the candidate's most relevant skills and experiences from their resume:
        --- RELEVANT EXPERIENCES ---
        {context}
        --- END RELEVANT EXPERIENCES ---
        
        Now, write the cover letter.
        """

        cover_letter = llm_client.generate_text(system_prompt, user_prompt)
        return cover_letter
    
    @staticmethod
    def get_jds_by_ids(ids: List[str]) -> List[Dict]:
        """
        Retrieves multiple job posting records from the database
        based on a list of their IDs.
        """
        try:            
            response = supabase.table("jobs")\
                .select("*")\
                .in_("id", ids)\
                .execute()
            
            return response.data
        except Exception as e:
            print(f"Error fetching job postings: {e}")
            return []