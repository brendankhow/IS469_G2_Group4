import logging
import time
import numpy as np
import os
from typing import List, Dict, Any, Set
from sklearn.metrics.pairwise import cosine_similarity
from datasets import Dataset
from dotenv import load_dotenv

load_dotenv()

os.environ["TOKENIZERS_PARALLELISM"] = "false"  # included to suppress HuggingFace tokenizers fork warning

from ragas import evaluate
from ragas.metrics import (
    context_precision,
    context_entity_recall,
    faithfulness,
    answer_relevancy,
)

from services.graphrag_service import GraphRAGService
from services.llama_wrappers import custom_embed_model

logger = logging.getLogger(__name__)

class GraphRAGEvaluator:
    """Evaluate GraphRAG performance using custom metrics + RAGAS."""

    TEST_EMAILS = [
        "01@test.com","02@test.com","03@test.com","04@test.com","05@test.com",
        "06@test.com","07@test.com","08@test.com","09@test.com","10@test.com",
        "11@test.com","12@test.com","13@test.com","14@test.com","15@test.com",
        "16@test.com","17@test.com","18@test.com","19@test.com","20@test.com"
    ]

    def __init__(self, use_ragas: bool = True, debug_ragas: bool = True, groq_api_key: str = None, top_k: int = 3, filter_emails: List[str] = None):
        self.graph_service = GraphRAGService()
        self.use_ragas = use_ragas
        self.debug_ragas = debug_ragas
        self.groq_api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        self.top_k = top_k
        self.filter_emails = filter_emails if filter_emails is not None else self.TEST_EMAILS

        if self.use_ragas and not self.groq_api_key:
            logger.warning("GROQ_API_KEY not found. Set it via environment variable or pass to constructor. Get free API key at: https://console.groq.com")
            self.use_ragas = False

    # RETRIEVAL METRICS

    def mean_reciprocal_rank(self, results: List[Dict], expected_ids: Set[str]) -> float:
        for i, r in enumerate(results, 1):
            if r.get('candidate_id') in expected_ids:
                return 1.0 / i
        return 0.0

    def precision_at_k(self, results: List[Dict], expected_ids: Set[str]) -> float:
        if not results:
            return 0.0
        relevant = sum(1 for r in results if r.get('candidate_id') in expected_ids)
        return relevant / len(results)

    def recall_at_k(self, results: List[Dict], expected_ids: Set[str]) -> float:
        if not expected_ids:
            return 0.0
        retrieved_ids = {r.get('candidate_id') for r in results}
        found = len(retrieved_ids & expected_ids)
        return found / len(expected_ids)

    # SEMANTIC METRICS

    def answer_similarity(self, results: List[Dict], ground_truth: str) -> float:
        """Cosine similarity between combined retrieved content and ground truth embedding."""
        if not results:
            return 0.0
        # GraphRAG returns structured data with student_name, summary, key_skills, etc.
        # combine relevant fields to create a comprehensive text representation
        retrieved_texts = []
        for r in results:
            text_parts = []
            if r.get('student_name'):
                text_parts.append(r['student_name'])
            if r.get('summary'):
                text_parts.append(r['summary'])
            if r.get('key_skills'):
                text_parts.append(', '.join(r['key_skills']))
            retrieved_texts.append(' '.join(text_parts))
        
        combined_text = " ".join(retrieved_texts)
        emb_query = np.array(custom_embed_model.get_query_embedding(ground_truth)).reshape(1, -1)
        emb_answer = np.array(custom_embed_model.get_query_embedding(combined_text)).reshape(1, -1)
        return float(cosine_similarity(emb_query, emb_answer)[0][0])

    # EVALUATION PIPELINE

    def evaluate_query(self, query: str, expected_ids: Set[str], ground_truth: str, top_k: int = 3) -> Dict[str, Any]:
        start_time = time.time()
        try:
            # pass filters to restrict to specified emails
            filters = {'filter_emails': self.filter_emails}
            result = self.graph_service.query_candidates(
                query_text=query, 
                top_k=top_k,
                filters=filters
            )
        except Exception as e:
            logger.error(f"Error querying GraphRAG for '{query}': {e}")
            result = {'results': []}
        latency = time.time() - start_time

        results = result.get('results', [])
        if results:
            answer = " | ".join([f"{r.get('student_name', 'Unknown')}: {', '.join(r.get('key_skills', []))}" for r in results])
            contexts = [f"{r.get('student_name')}: {r.get('summary', '')} | Skills: {', '.join(r.get('key_skills', []))}" for r in results]
        else:
            answer = "No results found"
            contexts = ["No context available"]

        metrics = {
            'mrr': self.mean_reciprocal_rank(results, expected_ids),
            'precision_at_k': self.precision_at_k(results, expected_ids),
            'recall_at_k': self.recall_at_k(results, expected_ids),
            'answer_similarity': self.answer_similarity(results, ground_truth),
            'query_latency_sec': latency,
        }

        return {
            'query': query,
            'answer': answer,
            'contexts': contexts,
            'ground_truth': ground_truth,
            'metrics': metrics,
            'results': results
        }

    def _setup_ragas_with_groq(self):
        """Setup RAGAS to use Groq API."""
        try:
            from langchain_groq import ChatGroq
            from langchain_core.embeddings import Embeddings

            groq_model_name = "llama-3.3-70b-versatile"
            logger.info(f"Using Groq model: {groq_model_name}")

            groq_llm = ChatGroq(
                model=groq_model_name,
                api_key=self.groq_api_key,
                temperature=0.0,
                n=1  # request only 1 generation to avoid 400 errors
            )

            class LocalEmbeddingsWrapper(Embeddings):
                """Wrapper for custom_embed_model."""
                def embed_documents(self, texts: List[str]) -> List[List[float]]:
                    return custom_embed_model.get_text_embeddings(texts)
                def embed_query(self, text: str) -> List[float]:
                    return custom_embed_model.get_query_embedding(text)

            logger.info("✓ Groq LLM setup successful!")
            logger.info(f"  Model: {groq_model_name}")
            logger.info(f"  Using local embeddings: {type(custom_embed_model).__name__}")

            return groq_llm, LocalEmbeddingsWrapper()

        except ImportError as e:
            logger.error(f"Failed to setup Groq: {e}")
            logger.error("Install required packages: pip install langchain-groq")
            return None, None
        except Exception as e:
            logger.error(f"Groq setup error: {type(e).__name__}: {e}")
            return None, None

    def _run_ragas_evaluation(self, ragas_data: Dict[str, List]) -> Dict[str, float]:
        ragas_scores = {}
        if not self.use_ragas:
            return ragas_scores

        try:
            groq_llm, embeddings = self._setup_ragas_with_groq()
            if groq_llm is None or embeddings is None:
                return ragas_scores

            ragas_dataset = Dataset.from_dict(ragas_data)
            metrics_to_evaluate = [context_precision, context_entity_recall, faithfulness, answer_relevancy]

            ragas_result = evaluate(
                dataset=ragas_dataset,
                metrics=metrics_to_evaluate,
                llm=groq_llm,
                embeddings=embeddings,
                raise_exceptions=False
            )

            ragas_df = ragas_result.to_pandas()
            skip_columns = {'question', 'answer', 'contexts', 'ground_truth', 'ground_truths', 'user_input', 'retrieved_contexts', 'response', 'reference'}
            for col in ragas_df.columns:
                if col not in skip_columns and np.issubdtype(ragas_df[col].dtype, np.number):
                    valid_scores = ragas_df[col].dropna()
                    if len(valid_scores) > 0:
                        ragas_scores[f'ragas_{col}'] = valid_scores.mean()

        except Exception as e:
            logger.error(f"RAGAS evaluation failed: {type(e).__name__}: {e}")

        return ragas_scores

    # MAIN EVALUATION

    def evaluate(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_results = []
        metric_sums = {}
        ragas_data = {'question': [], 'answer': [], 'contexts': [], 'ground_truth': []}

        for case in test_cases:
            eval_result = self.evaluate_query(
                query=case['question'],
                expected_ids=case.get('expected_ids', set()),
                ground_truth=case.get('ground_truth', ''),
                top_k=case.get('top_k', self.top_k)
            )
            all_results.append(eval_result)
            for metric, value in eval_result['metrics'].items():
                metric_sums[metric] = metric_sums.get(metric, 0.0) + value
            ragas_data['question'].append(eval_result['query'])
            ragas_data['answer'].append(eval_result['answer'])
            ragas_data['contexts'].append(eval_result['contexts'])
            ragas_data['ground_truth'].append(eval_result['ground_truth'])

            # print per-query results
            results = eval_result['results']
            print(f"Query: {case['question'][:50]}...")
            print(f"Top {case.get('top_k', self.top_k)} candidates: {[(r.get('student_name'), r.get('candidate_id')) for r in results]}")
            print(f"MRR: {eval_result['metrics']['mrr']:.2f}, "
                  f"Precision@{case.get('top_k', self.top_k)}: {eval_result['metrics']['precision_at_k']:.2f}, "
                  f"Recall@{case.get('top_k', self.top_k)}: {eval_result['metrics']['recall_at_k']:.2f}, "
                  f"AnswerSim: {eval_result['metrics']['answer_similarity']:.2f}, "
                  f"Latency: {eval_result['metrics']['query_latency_sec']:.2f}s\n")

        avg_metrics = {metric: total / len(test_cases) for metric, total in metric_sums.items()}
        ragas_scores = self._run_ragas_evaluation(ragas_data)
        combined_metrics = {**avg_metrics, **ragas_scores}

        return {
            'average_metrics': combined_metrics,
            'custom_metrics': avg_metrics,
            'ragas_metrics': ragas_scores,
            'detailed_results': all_results,
            'num_queries': len(test_cases)
        }

def run_evaluation(use_ragas: bool = True, debug_ragas: bool = True, groq_api_key: str = None, top_k: int = 3, filter_emails: List[str] = None):
    
    # manually checked graphrag_portfolio table for keywords in the text column
    # (used OR, not AND, so less restricted) expected_ids have at least 1 required keyword from question in the text column
    test_cases = [
        {
            "question": "Candidates with Python and machine learning experience",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates strong in Python, ML, and data projects.",
            "top_k": top_k
        },
        {
            "question": "Software engineers familiar with React and Node.js",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates experienced with full-stack web development.",
            "top_k": top_k
        },
        {
            "question": "Students skilled in Java and OOP principles",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with strong Java programming and OOP experience.",
            "top_k": top_k
        },
        {
            "question": "Data engineers with SQL and AWS experience",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates proficient in SQL databases, AWS, and data pipelines.",
            "top_k": top_k
        },
        {
            "question": "Machine learning researchers with PyTorch experience",
            "expected_ids": {
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates who have built ML models using PyTorch or TensorFlow.",
            "top_k": top_k
        },
        {
            "question": "Web developers familiar with HTML, CSS, and JavaScript",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with front-end development experience.",
            "top_k": top_k
        },
        {
            "question": "Students with GitHub portfolios showcasing projects",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with active GitHub profiles demonstrating technical work.",
            "top_k": top_k
        },
        {
            "question": "Interns with experience in teaching or mentoring CS students",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates who have tutored, mentored, or taught CS topics.",
            "top_k": top_k
        },
        {
            "question": "Students with experience in cloud platforms or Docker",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
            },
            "ground_truth": "Candidates familiar with AWS, Docker, or cloud-based workflows.",
            "top_k": top_k
        },
        {
            "question": "Candidates with skills in data visualization and reporting",
            "expected_ids": {
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates able to process data and create visual reports.",
            "top_k": top_k
        },
    ]

    evaluator = GraphRAGEvaluator(use_ragas=use_ragas, debug_ragas=debug_ragas, groq_api_key=groq_api_key, top_k=top_k, filter_emails=filter_emails)
    results = evaluator.evaluate(test_cases)

    # DISPLAY RESULTS

    metrics = results['average_metrics']
    print("\nFINAL RESULTS")
    print("=" * 40)
    print(f"Average MRR: {metrics.get('mrr', 0):.2f}")
    print(f"Average Precision@{top_k}: {metrics.get('precision_at_k', 0):.2f}")
    print(f"Average Recall@{top_k}: {metrics.get('recall_at_k', 0):.2f}")
    print(f"Average Answer Similarity: {metrics.get('answer_similarity', 0):.2f}")
    print(f"Average Query Latency: {metrics.get('query_latency_sec', 0):.2f}s")

    if results['ragas_metrics']:
        print("\nRAGAS METRICS:")
        for metric_name, score in sorted(results['ragas_metrics'].items()):
            display_name = metric_name.replace('ragas_', '').replace('_', ' ').title()
            print(f"  {display_name:40s} {score:.4f}")
    else:
        print("\nNo RAGAS metrics available (check logs)!")

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    run_evaluation(use_ragas=False, debug_ragas=False, top_k=3, filter_emails=GraphRAGEvaluator.TEST_EMAILS)