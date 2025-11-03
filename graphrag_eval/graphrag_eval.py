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

    def __init__(self, use_ragas: bool = True, debug_ragas: bool = True, groq_api_key: str = None):
        self.graph_service = GraphRAGService()
        self.use_ragas = use_ragas
        self.debug_ragas = debug_ragas
        self.groq_api_key = groq_api_key or os.getenv("GROQ_API_KEY")

        if self.use_ragas and not self.groq_api_key:
            logger.warning("GROQ_API_KEY not found. Set it via environment variable or pass to constructor.")
            logger.warning("Get free API key at: https://console.groq.com")
            self.use_ragas = False

    # RETRIEVAL METRICS

    def hit_rate(self, results: List[Dict], expected_ids: Set[str]) -> float:
        retrieved_ids = {r.get('candidate_id') for r in results}
        return 1.0 if retrieved_ids & expected_ids else 0.0

    def mean_reciprocal_rank(self, results: List[Dict], expected_ids: Set[str]) -> float:
        for i, r in enumerate(results, 1):
            if r.get('candidate_id') in expected_ids:
                return 1.0 / i
        return 0.0

    def precision_at_k(self, results: List[Dict], expected_ids: Set[str], k: int = 3) -> float:
        top_k = results[:k]
        if not top_k:
            return 0.0
        relevant = sum(1 for r in top_k if r.get('candidate_id') in expected_ids)
        return relevant / len(top_k)

    def coverage_rate(self, results: List[Dict], expected_ids: Set[str]) -> float:
        if not expected_ids:
            return 1.0
        retrieved_ids = {r.get('candidate_id') for r in results}
        found = len(retrieved_ids & expected_ids)
        return found / len(expected_ids)

    # SEMANTIC METRICS

    def semantic_similarity(self, text1: str, text2: str) -> float:
        emb1 = np.array(custom_embed_model.get_query_embedding(text1)).reshape(1, -1)
        emb2 = np.array(custom_embed_model.get_query_embedding(text2)).reshape(1, -1)
        return float(cosine_similarity(emb1, emb2)[0][0])

    def context_coverage(self, query: str, contexts: List[str]) -> float:
        if not contexts:
            return 0.0
        query_emb = np.array(custom_embed_model.get_query_embedding(query)).reshape(1, -1)
        similarities = [
            cosine_similarity(
                query_emb,
                np.array(custom_embed_model.get_query_embedding(ctx)).reshape(1, -1)
            )[0][0] for ctx in contexts
        ]
        return float(max(similarities))

    # SKILL MATCHING METRICS

    def skill_overlap(self, candidate_skills: List[str], required_skills: List[str]) -> float:
        if not required_skills:
            return 1.0
        candidate_set = {s.lower().strip() for s in candidate_skills}
        required_set = {s.lower().strip() for s in required_skills}
        intersection = candidate_set & required_set
        union = candidate_set | required_set
        return len(intersection) / len(union) if union else 0.0

    def avg_skill_match(self, results: List[Dict], required_skills: List[str]) -> float:
        if not results:
            return 0.0
        scores = [self.skill_overlap(r.get('key_skills', []), required_skills) for r in results]
        return sum(scores) / len(scores)

    def diversity_score(self, results: List[Dict]) -> float:
        if len(results) < 2:
            return 0.0
        skill_sets = [set(s.lower() for s in r.get('key_skills', [])) for r in results]
        total_similarity = 0.0
        pairs = 0
        for i in range(len(skill_sets)):
            for j in range(i + 1, len(skill_sets)):
                union = skill_sets[i] | skill_sets[j]
                if union:
                    jaccard = len(skill_sets[i] & skill_sets[j]) / len(union)
                    total_similarity += jaccard
                    pairs += 1
        if pairs == 0:
            return 0.0
        avg_similarity = total_similarity / pairs
        return 1.0 - avg_similarity

    # EVALUATION PIPELINE

    def evaluate_query(self, query: str, expected_ids: Set[str], required_skills: List[str], ground_truth: str, top_k: int = 3) -> Dict[str, Any]:
        start_time = time.time()
        try:
            result = self.graph_service.query_candidates(query_text=query, top_k=top_k)
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
            'hit_rate': self.hit_rate(results, expected_ids),
            'mrr': self.mean_reciprocal_rank(results, expected_ids),
            'precision_at_k': self.precision_at_k(results, expected_ids, k=top_k),
            'coverage_rate': self.coverage_rate(results, expected_ids),
            'answer_similarity': self.semantic_similarity(answer, ground_truth),
            'context_coverage': self.context_coverage(query, contexts),
            'avg_skill_match': self.avg_skill_match(results, required_skills),
            'diversity_score': self.diversity_score(results),
            'query_latency_sec': latency,
            'num_results': len(results)
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
        """Setup RAGAS to use Groq API (fast & free)."""
        try:
            from langchain_groq import ChatGroq
            from langchain_core.embeddings import Embeddings

            groq_model_name = "llama-3.3-70b-versatile"
            logger.info(f"Using Groq model: {groq_model_name}")

            groq_llm = ChatGroq(
                model=groq_model_name,
                api_key=self.groq_api_key,
                temperature=0.0,
                n=1  # ✅ Fix: request only 1 generation to avoid 400 errors
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

        for test_case in test_cases:
            eval_result = self.evaluate_query(
                query=test_case['question'],
                expected_ids=test_case.get('expected_ids', set()),
                required_skills=test_case.get('required_skills', []),
                ground_truth=test_case.get('ground_truth', ''),
                top_k=test_case.get('top_k', 3)
            )
            all_results.append(eval_result)
            for metric, value in eval_result['metrics'].items():
                metric_sums[metric] = metric_sums.get(metric, 0.0) + value
            ragas_data['question'].append(eval_result['query'])
            ragas_data['answer'].append(eval_result['answer'])
            ragas_data['contexts'].append(eval_result['contexts'])
            ragas_data['ground_truth'].append(eval_result['ground_truth'])

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

def run_evaluation(use_ragas: bool = True, debug_ragas: bool = True, groq_api_key: str = None):
    test_cases = [
        {
            'question': 'Find candidates with Python and machine learning experience',
            'expected_ids': {'24157fb5-0fa9-4478-901e-78b193ba6573', '4772799a-28cc-4299-8c32-c6a1bf15a777', '55bee374-6f86-4048-b8fa-66255e829ce9', 'b79d3180-021b-47ff-ba49-6ce11c88b54f', 'dd5b35f8-2262-42bc-954e-8131afd6e367'},
            'required_skills': ['Python', 'Machine Learning', 'ML', 'AI'],
            'ground_truth': 'Candidates with Python programming and ML/AI expertise',
            'top_k': 3
        },
        {
            'question': 'Software engineers with React and Node.js experience',
            'expected_ids': {'b79d3180-021b-47ff-ba49-6ce11c88b54f', 'c9334fa8-f3e9-40c4-a7be-ae9bb7e69bf5', 'dd5b35f8-2262-42bc-954e-8131afd6e367', '2cb9a271-7773-40cd-ace7-a4c8387b4358', '045e1245-fb93-472e-8c22-05ae57a4eb9d'},
            'required_skills': ['React', 'Node.js', 'JavaScript', 'Full Stack'],
            'ground_truth': 'Full-stack JavaScript developers with React and Node.js',
            'top_k': 3
        },
    ]

    evaluator = GraphRAGEvaluator(use_ragas=use_ragas, debug_ragas=debug_ragas, groq_api_key=groq_api_key)
    results = evaluator.evaluate(test_cases)

    # DISPLAY RESULTS

    metrics = results['average_metrics']
    print("\nGRAPHRAG EVALUATION RESULTS")
    print("=" * 60)
    print(f"Evaluated {results['num_queries']} queries")

    print("\nRETRIEVAL QUALITY:")
    print(f"  Hit Rate: {metrics.get('hit_rate', 0):.2%}")
    print(f"  MRR: {metrics.get('mrr', 0):.3f}")
    print(f"  Precision@K: {metrics.get('precision_at_k', 0):.2%}")
    print(f"  Coverage Rate: {metrics.get('coverage_rate', 0):.2%}")

    print("\nSEMANTIC QUALITY:")
    print(f"  Answer Similarity: {metrics.get('answer_similarity', 0):.3f}")
    print(f"  Context Coverage: {metrics.get('context_coverage', 0):.3f}")

    print("\nSKILL MATCHING:")
    print(f"  Avg Skill Match: {metrics.get('avg_skill_match', 0):.2%}")
    print(f"  Diversity Score: {metrics.get('diversity_score', 0):.3f}")

    print("\nPERFORMANCE:")
    print(f"  Avg Query Latency: {metrics.get('query_latency_sec', 0):.2f}s")
    print(f"  Avg Results Returned: {metrics.get('num_results', 0):.1f}")

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
    run_evaluation(use_ragas=True, debug_ragas=True)