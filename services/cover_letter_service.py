# services/cover_letter_service.py
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
    def generate_cover_letter_for_job(job_description: str, relevant_experience_chunks: List[str], student_profile: Dict) -> str:
        """
        Generates a tailored cover letter using a JD and relevant resume snippets.
        """
        print("LLM Service: Generating cover letter...")

        context = "\n- ".join(relevant_experience_chunks)
        student_name = student_profile.get("name", "[Your Name]")
        
        system_prompt = f"""
        You are a professional career writer crafting a compelling, concise, and professional cover letter for a student. 
        Your task is to generate ONLY the body of the cover letter.
        - Do NOT include student's address, date, or the hiring manager's address).
        - Start the letter directly with "Dear Hiring Manager,".
        - End the letter with "Best regards," followed by the student's name.
        - The student's name is {student_name}.
        - You MUST seamlessly weave the candidate's most relevant experiences into a narrative. 
        - Do not just list their skills; connect them to the job's requirements and tell a story.
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
        
    @staticmethod
    def refine_cover_letter(original_letter: str, user_instruction: str) -> str:
        """
        Refines cover letter.
        """
        print("LLM Service: Refining cover letter...")
        
        system_prompt = """
        You are an AI writing assistant. Your task is to rewrite and improve an existing cover letter based on the user's specific instruction.
        - You MUST return ONLY the full, rewritten cover letter body.
        - Do NOT add headers, addresses, or any text other than the refined letter.
        - Adhere strictly to the user's instruction (e.g., 'make it more formal,' 'shorten it,' 'focus more on my Python skills').
        """
        
        user_prompt = f"""
        <OriginalCoverLetter>
        {original_letter}
        </OriginalCoverLetter>

        <UserInstruction>
        {user_instruction}
        </UserInstruction>

        Now, please provide the complete, rewritten cover letter body based on the instruction.
        """

        refined_letter = llm_client.generate_text(system_prompt, user_prompt)
        return refined_letter